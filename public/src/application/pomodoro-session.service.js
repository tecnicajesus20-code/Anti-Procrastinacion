import {
  POMODORO_DEFAULTS,
  POMODORO_SESSION_STATUS,
  planPomodoroTask,
  summarizePomodoroTask,
} from "../domain/pomodoro.js";

/**
 * Registra sesiones verificables de enfoque en la tarea y coordina el temporizador.
 * La cuenta regresiva nunca marca una sesión como completada: queda pendiente de confirmación.
 */
export function createPomodoroSessionService({
  taskService,
  pomodoro,
  workSeconds = POMODORO_DEFAULTS.workSeconds,
  breakSeconds = POMODORO_DEFAULTS.breakSeconds,
  now = () => new Date(),
  createId = () => crypto.randomUUID(),
  storage = null,
  storageKey = "antiprocrastinacion:pomodoro-break:v1",
  onError,
} = {}) {
  if (!taskService || !pomodoro) throw new TypeError("Se requieren taskService y pomodoro.");
  if (typeof onError !== "function") throw new TypeError("Se requiere onError para informar errores del temporizador.");

  let current = null;
  let timerState = null;
  let completionInFlight = null;
  let breakContext = null;
  let restoringSession = false;
  let storageScope = "guest";
  const listeners = new Set();

  const findTask = (taskId) => taskService.getAll().find((task) => task.id === taskId);
  const findSession = (taskId, sessionId) => findTask(taskId)?.pomodoroSessions?.find((session) => session.id === sessionId) ?? null;
  const emit = () => listeners.forEach((callback) => callback(getState()));
  const getState = () => ({
    currentSession: current ? findSession(current.taskId, current.sessionId) : null,
    currentTask: current ? findTask(current.taskId) : null,
    timer: timerState,
  });
  const checkpointStorageKey = () => `${storageKey}:${encodeURIComponent(storageScope)}`;

  function readBreakCheckpoint() {
    if (!storage) return null;
    let serialized;
    try {
      serialized = storage.getItem(checkpointStorageKey());
      if (serialized === null) return null;
      const checkpoint = JSON.parse(serialized);
      if (
        checkpoint?.version !== 1
        || typeof checkpoint.taskId !== "string"
        || !Number.isInteger(checkpoint.blockIndex)
        || !Number.isInteger(checkpoint.sessionIndex)
        || !Number.isFinite(checkpoint.remainingSeconds)
        || checkpoint.remainingSeconds <= 0
        || checkpoint.remainingSeconds > breakSeconds
        || (checkpoint.runningSince !== null && Number.isNaN(Date.parse(checkpoint.runningSince)))
      ) {
        throw new Error("El estado del descanso Pomodoro guardado no es válido.");
      }
      return checkpoint;
    } catch (error) {
      onError(error instanceof SyntaxError
        ? new Error("No se pudo leer el estado del descanso Pomodoro.", { cause: error })
        : error);
      return null;
    }
  }

  function writeBreakCheckpoint(checkpoint) {
    if (!storage) return;
    try {
      if (checkpoint) storage.setItem(checkpointStorageKey(), JSON.stringify({ version: 1, ...checkpoint }));
      else storage.removeItem(checkpointStorageKey());
    } catch (error) {
      onError(error);
    }
  }

  async function saveSession(task, session) {
    const sessions = task.pomodoroSessions ?? [];
    const nextSessions = sessions.some((item) => item.id === session.id)
      ? sessions.map((item) => (item.id === session.id ? session : item))
      : [...sessions, session];
    const summary = summarizePomodoroTask(task, nextSessions, { workSeconds, breakSeconds });
    await taskService.update(task.id, {
      pomodoroSessions: nextSessions,
      pomodoroCompletionRate: summary.completionRate,
      pomodoroStatus: summary.status,
    });
    emit();
  }

  async function finishTimerSession() {
    if (!current || completionInFlight === current.sessionId) return;
    const sessionId = current.sessionId;
    const task = findTask(current.taskId);
    const session = findSession(current.taskId, sessionId);
    if (!task || !session || session.endedAt || session.status !== POMODORO_SESSION_STATUS.PENDING) return;
    completionInFlight = sessionId;
    try {
      await saveSession(task, {
        ...session,
        actualDurationSeconds: session.plannedDurationSeconds,
        endedAt: now().toISOString(),
        runningSince: null,
      });
    } finally {
      completionInFlight = null;
    }
  }

  pomodoro.onTick((state) => {
    const previousMode = timerState?.mode;
    timerState = state;
    if (state.awaitingConfirmation) {
      finishTimerSession().catch(onError);
    }
    if (breakContext && previousMode === "break" && state.mode === "work") {
      writeBreakCheckpoint(null);
      startNextCycle();
    }
  });

  function startNextCycle() {
    const context = breakContext;
    breakContext = null;
    const task = context && findTask(context.taskId);
    if (!task) {
      current = null;
      writeBreakCheckpoint(null);
      pomodoro.reset();
      emit();
      return;
    }

    const nextSlot = nextFocusSlot(task, context.blockIndex, context.sessionIndex);
    if (nextSlot) {
      start(context.taskId, context.blockIndex, nextSlot.scheduleKey).catch(onError);
      return;
    }

    current = null;
    pomodoro.reset();
    emit();
  }

  function nextFocusSlot(task, blockIndex, afterSessionIndex) {
    const sessions = task.pomodoroSessions ?? [];
    return planPomodoroTask(task, { workSeconds, breakSeconds }).find((slot) => (
      slot.kind === "focus"
      && slot.blockIndex === blockIndex
      && slot.sessionIndex > afterSessionIndex
      && !sessions.some((session) => (
        session.scheduleKey === slot.scheduleKey
        && session.status !== POMODORO_SESSION_STATUS.PENDING
      ))
    ));
  }

  function restoreRunningSession() {
    if (current || restoringSession) return;
    const runningSessions = taskService.getAll().flatMap((task) => (
      task.pomodoroSessions ?? []
    ).filter((session) => (
      session.status === POMODORO_SESSION_STATUS.PENDING
      && !session.endedAt
      && session.runningSince
    )).map((session) => ({ taskId: task.id, session })));

    if (runningSessions.length > 1) {
      onError(new Error("Hay más de una sesión Pomodoro activa; reanúdalas o regístralas desde Tareas."));
      return;
    }
    const active = runningSessions[0];
    if (!active) return;

    restoringSession = true;
    start(active.taskId, active.session.blockIndex, active.session.scheduleKey)
      .catch(onError)
      .finally(() => { restoringSession = false; });
  }

  function restorePersistentTimer() {
    if (current || restoringSession) return;
    const tasks = taskService.getAll();
    if (tasks.length === 0) return;
    const checkpoint = readBreakCheckpoint();
    if (checkpoint) {
      const task = findTask(checkpoint.taskId);
      const session = task?.pomodoroSessions?.find((candidate) => (
        candidate.status === POMODORO_SESSION_STATUS.COMPLETED
        && candidate.blockIndex === checkpoint.blockIndex
        && candidate.sessionIndex === checkpoint.sessionIndex
      ));
      const hasScheduledBreak = task && planPomodoroTask(task, { workSeconds, breakSeconds }).some((slot) => (
        slot.kind === "break"
        && slot.blockIndex === checkpoint.blockIndex
        && slot.sessionIndex === checkpoint.sessionIndex
      ));
      if (!session || !hasScheduledBreak) {
        writeBreakCheckpoint(null);
      } else {
        const elapsed = checkpoint.runningSince
          ? Math.max(0, (now().getTime() - Date.parse(checkpoint.runningSince)) / 1000)
          : 0;
        const remainingSeconds = checkpoint.remainingSeconds - elapsed;
        current = { taskId: task.id, sessionId: session.id };
        breakContext = {
          taskId: task.id,
          blockIndex: checkpoint.blockIndex,
          sessionIndex: checkpoint.sessionIndex,
        };
        if (remainingSeconds <= 0) {
          writeBreakCheckpoint(null);
          startNextCycle();
        } else {
          pomodoro.startBreak({
            remainingSeconds,
            running: Boolean(checkpoint.runningSince),
          });
          emit();
        }
        return;
      }
    }
    restoreRunningSession();
  }

  taskService.subscribe(() => {
    if (current && !findSession(current.taskId, current.sessionId)) {
      current = null;
      breakContext = null;
      pomodoro.reset();
    }
    restorePersistentTimer();
    emit();
  });
  restorePersistentTimer();

  function setStorageScope(scope) {
    const nextScope = String(scope || "guest");
    if (nextScope === storageScope) return;
    breakContext = null;
    current = null;
    pomodoro.reset();
    storageScope = nextScope;
    emit();
  }

  async function start(taskId, block, scheduleKey) {
    const task = findTask(taskId);
    if (!task) throw new Error("No se encontró la tarea seleccionada.");

    const blocks = Array.isArray(task.blocks) && task.blocks.length
      ? task.blocks
      : [{ start: task.start, end: task.end }];
    const blockIndex = Number.isInteger(block)
      ? block
      : blocks.findIndex((candidate) => candidate.start === block?.start && candidate.end === block?.end);
    if (blockIndex < 0 || blockIndex >= blocks.length) throw new Error("No se encontró el bloque de la tarea.");

    if (current) {
      const activeSession = findSession(current.taskId, current.sessionId);
      if (activeSession?.status === POMODORO_SESSION_STATUS.PENDING) {
        if (current.taskId !== taskId) throw new Error("Termina la sesión actual antes de iniciar otra tarea.");
        if (activeSession.endedAt) {
          throw new Error("Confirma o registra como incumplida la sesión actual antes de iniciar otra.");
        }
        if (blockIndex !== activeSession.blockIndex || (scheduleKey && scheduleKey !== activeSession.scheduleKey)) {
          throw new Error("Termina o registra como incumplida la sesión actual antes de iniciar otro bloque.");
        }
        if (timerState?.running) return activeSession;
        scheduleKey = activeSession.scheduleKey;
      }
    }

    const slots = planPomodoroTask(task, { workSeconds, breakSeconds })
      .filter((slot) => slot.kind === "focus" && slot.blockIndex === blockIndex);
    const sessions = task.pomodoroSessions ?? [];
    const slot = scheduleKey
      ? slots.find((candidate) => candidate.scheduleKey === scheduleKey)
      : slots.find((candidate) => !sessions.some((session) => session.scheduleKey === candidate.scheduleKey && session.status !== POMODORO_SESSION_STATUS.PENDING));
    if (!slot) throw new Error("Este bloque no tiene sesiones Pomodoro pendientes.");

    let session = sessions.find((item) => item.scheduleKey === slot.scheduleKey) ?? null;
    if (session && session.status !== POMODORO_SESSION_STATUS.PENDING) {
      throw new Error("Esta sesión Pomodoro ya tiene un resultado registrado.");
    }
    if (session?.endedAt) {
      current = { taskId, sessionId: session.id };
      pomodoro.awaitWorkConfirmation();
      emit();
      return session;
    }

    const timestamp = now();
    let elapsed = session?.actualDurationSeconds ?? 0;
    if (session?.runningSince) {
      elapsed += Math.max(0, Math.floor((timestamp.getTime() - Date.parse(session.runningSince)) / 1000));
    }

    if (!session) {
      session = {
        id: createId(),
        taskId,
        ownerUid: task.userId ?? null,
        blockIndex,
        sessionIndex: slot.sessionIndex,
        scheduleKey: slot.scheduleKey,
        scheduledStart: slot.start,
        scheduledEnd: slot.end,
        plannedDurationSeconds: slot.durationSeconds,
        actualDurationSeconds: 0,
        startedAt: timestamp.toISOString(),
        endedAt: null,
        runningSince: null,
        status: POMODORO_SESSION_STATUS.PENDING,
        failureReason: null,
      };
    }

    current = { taskId, sessionId: session.id };
    if (elapsed >= session.plannedDurationSeconds) {
      await saveSession(task, {
        ...session,
        actualDurationSeconds: session.plannedDurationSeconds,
        endedAt: timestamp.toISOString(),
        runningSince: null,
      });
      pomodoro.awaitWorkConfirmation();
      return findSession(taskId, session.id);
    }

    session = { ...session, actualDurationSeconds: elapsed, runningSince: timestamp.toISOString() };
    await saveSession(task, session);
    pomodoro.startWorkSession({ remainingSeconds: session.plannedDurationSeconds - elapsed });
    emit();
    return session;
  }

  async function resume(taskId, sessionId) {
    const session = findSession(taskId, sessionId);
    if (!session) throw new Error("No se encontró la sesión que se quiere reanudar.");
    return start(taskId, session.blockIndex, session.scheduleKey);
  }

  async function pause() {
    const state = timerState;
    pomodoro.pause();
    if (breakContext && state?.mode === "break" && state.running) {
      writeBreakCheckpoint({
        ...breakContext,
        remainingSeconds: state.remaining,
        runningSince: null,
      });
      return;
    }
    if (!current || !state?.running) return;
    const session = findSession(current.taskId, current.sessionId);
    const task = findTask(current.taskId);
    if (!task || !session || session.endedAt || session.status !== POMODORO_SESSION_STATUS.PENDING) return;

    await saveSession(task, {
      ...session,
      actualDurationSeconds: Math.min(session.plannedDurationSeconds, session.plannedDurationSeconds - state.remaining),
      runningSince: null,
    });
  }

  async function continueAfterSession(task, session) {
    const plan = planPomodoroTask(task, { workSeconds, breakSeconds });
    const breakSlot = plan.find((slot) => (
      slot.kind === "break"
      && slot.blockIndex === session.blockIndex
      && slot.sessionIndex === session.sessionIndex
    ));
    if (breakSlot) {
      breakContext = {
        taskId: task.id,
        blockIndex: session.blockIndex,
        sessionIndex: session.sessionIndex,
      };
      pomodoro.startBreak();
      writeBreakCheckpoint({
        ...breakContext,
        remainingSeconds: breakSeconds,
        runningSince: now().toISOString(),
      });
      emit();
      return;
    }

    const nextSlot = nextFocusSlot(task, session.blockIndex, session.sessionIndex);
    if (nextSlot) {
      start(task.id, session.blockIndex, nextSlot.scheduleKey).catch(onError);
      return;
    }

    current = null;
    breakContext = null;
    pomodoro.reset();
    emit();
  }

  async function confirm(taskId, sessionId) {
    const task = findTask(taskId);
    const session = findSession(taskId, sessionId);
    if (!task || !session || session.status !== POMODORO_SESSION_STATUS.PENDING) {
      throw new Error("No se encontró una sesión pendiente para confirmar.");
    }
    if (!session.endedAt || session.actualDurationSeconds < session.plannedDurationSeconds) {
      throw new Error("La sesión debe terminar antes de poder confirmarla.");
    }

    await saveSession(task, { ...session, status: POMODORO_SESSION_STATUS.COMPLETED, runningSince: null });
    await continueAfterSession(task, session);
  }

  function resumeBreak() {
    if (!breakContext || timerState?.mode !== "break") {
      throw new Error("No hay un descanso Pomodoro pausado para reanudar.");
    }
    const checkpoint = readBreakCheckpoint();
    if (!checkpoint || checkpoint.taskId !== breakContext.taskId) {
      throw new Error("No se encontró el estado guardado del descanso Pomodoro.");
    }
    if (timerState.running) return;
    const timestamp = now().toISOString();
    pomodoro.start();
    writeBreakCheckpoint({ ...checkpoint, runningSince: timestamp });
    emit();
  }

  async function markUnfulfilled(taskId, sessionId, reason) {
    const task = findTask(taskId);
    let session = findSession(taskId, sessionId);
    if (!task || !session || session.status !== POMODORO_SESSION_STATUS.PENDING) {
      throw new Error("No se encontró una sesión pendiente para registrar.");
    }

    const timestamp = now();
    if (current?.taskId === taskId && current.sessionId === sessionId) {
      const state = timerState;
      pomodoro.pause();
      if (state?.running) {
        session = {
          ...session,
          actualDurationSeconds: Math.min(session.plannedDurationSeconds, session.plannedDurationSeconds - state.remaining),
        };
      }
    } else if (session.runningSince) {
      session = {
        ...session,
        actualDurationSeconds: Math.min(
          session.plannedDurationSeconds,
          session.actualDurationSeconds + Math.max(0, Math.floor((timestamp.getTime() - Date.parse(session.runningSince)) / 1000))
        ),
      };
    }

    const completedSession = {
      ...session,
      endedAt: session.endedAt ?? timestamp.toISOString(),
      runningSince: null,
      status: POMODORO_SESSION_STATUS.UNFULFILLED,
      failureReason: String(reason ?? "").trim() || "Sin motivo indicado.",
    };
    await saveSession(task, completedSession);
    if (current?.taskId === taskId && current.sessionId === sessionId) {
      await continueAfterSession(task, session);
    }
  }

  function reset() {
    const session = current ? findSession(current.taskId, current.sessionId) : null;
    if (session?.status === POMODORO_SESSION_STATUS.PENDING) {
      return markUnfulfilled(current.taskId, session.id, "Sesión reiniciada por el usuario.");
    }
    current = null;
    breakContext = null;
    writeBreakCheckpoint(null);
    pomodoro.reset();
    emit();
    return Promise.resolve();
  }

  function subscribe(callback) {
    listeners.add(callback);
    callback(getState());
    return () => listeners.delete(callback);
  }

  return {
    start,
    resume,
    resumeBreak,
    pause,
    reset,
    confirm,
    markUnfulfilled,
    getState,
    getCurrentSession: () => getState().currentSession,
    subscribe,
    setStorageScope,
  };
}
