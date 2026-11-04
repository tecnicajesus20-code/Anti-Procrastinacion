/** PRESENTACIÓN DEL POMODORO: muestra el tiempo y conecta los botones. */
import { byId } from "../../shared/dom.js";
import { formatMinutesSeconds, formatShortDateTime } from "../../shared/date-time.js";
import { POMODORO_MODE, POMODORO_DEFAULTS, planPomodoroTask } from "../../domain/pomodoro.js";
import { runAction } from "../../shared/feedback.js";

const MODE_LABELS = { [POMODORO_MODE.WORK]: "Trabajo", [POMODORO_MODE.BREAK]: "Descanso" };

/**
 * Conecta el temporizador con sesiones de enfoque trazables y confirmación explícita del usuario.
 * @param {ReturnType<import("../../application/pomodoro.service.js").createPomodoroService>} pomodoro
 * @param {ReturnType<import("../../application/pomodoro-session.service.js").createPomodoroSessionService>} pomodoroSessions
 * @param {{navigate: (route: string) => void}} navigation
 */
export function initPomodoroUi(pomodoro, pomodoroSessions, navigation) {
  const time = byId("pomodoro-time");
  const mode = byId("pomodoro-mode");
  const card = byId("pomodoro-card");
  const ring = byId("pomodoro-ring");
  const taskLabel = byId("pomodoro-task");
  const cycleLabel = byId("pomodoro-cycle");
  const progress = byId("pomodoro-progress");
  const sessionStatus = byId("pomodoro-session-status");
  const confirmButton = byId("pomodoro-confirm");
  const failButton = byId("pomodoro-fail");

  function renderSession(state = pomodoroSessions.getState()) {
    const { currentSession: session, currentTask: task } = state;
    if (!session || !task) {
      taskLabel.textContent = "Sin tarea seleccionada";
      cycleLabel.textContent = "Sin ciclo programado";
      sessionStatus.textContent = "";
      confirmButton.hidden = true;
      failButton.hidden = true;
      return;
    }

    taskLabel.textContent = `Tarea: ${task.title} · Enfoque programado: ${formatShortDateTime(session.scheduledStart)}`;
    const cycleCount = planPomodoroTask(task).filter((slot) => (
      slot.kind === "focus" && slot.blockIndex === session.blockIndex
    )).length;
    cycleLabel.textContent = `Ciclo ${session.sessionIndex + 1} de ${Math.max(cycleCount, session.sessionIndex + 1)}`;

    if (state.timer?.mode === POMODORO_MODE.BREAK && session.status === "completed") {
      sessionStatus.textContent = "Sesión completada. Descanso programado.";
      confirmButton.hidden = true;
      failButton.hidden = true;
    } else if (session.status === "completed") {
      sessionStatus.textContent = "Sesión completada y registrada.";
      confirmButton.hidden = true;
      failButton.hidden = true;
    } else if (session.status === "unfulfilled") {
      sessionStatus.textContent = `Sesión incumplida: ${session.failureReason ?? "sin motivo indicado"}`;
      confirmButton.hidden = true;
      failButton.hidden = true;
    } else if (session.endedAt) {
      sessionStatus.textContent = "El tiempo terminó. Confirma la sesión o regístrala como incumplida.";
      confirmButton.hidden = false;
      failButton.hidden = false;
    } else {
      sessionStatus.textContent = state.timer?.running
        ? "Sesión en curso. Al terminar quedará pendiente hasta que registres el resultado."
        : "Sesión pendiente. Puedes reanudarla o registrarla como incumplida.";
      confirmButton.hidden = true;
      failButton.hidden = false;
    }
  }

  pomodoro.onTick((state) => {
    time.textContent = formatMinutesSeconds(state.remaining);
    mode.textContent = state.awaitingConfirmation ? "Confirmación pendiente" : MODE_LABELS[state.mode];
    const activeSession = pomodoroSessions.getCurrentSession();

    const progressTotal = state.mode === POMODORO_MODE.WORK
      ? activeSession?.plannedDurationSeconds ?? POMODORO_DEFAULTS.workSeconds
      : POMODORO_DEFAULTS.breakSeconds;
    ring.style.setProperty("stroke-dashoffset", String(1 - state.remaining / progressTotal));
    progress.value = Math.max(0, Math.min(1, 1 - state.remaining / progressTotal));
    progress.setAttribute(
      "aria-label",
      state.mode === POMODORO_MODE.BREAK ? "Progreso del descanso" : "Progreso del ciclo"
    );
    card.classList.toggle("pomodoro--break", state.mode === POMODORO_MODE.BREAK);
    card.classList.toggle("pomodoro--running", state.running);
    renderSession();
  });
  pomodoroSessions.subscribe((state) => {
    renderSession(state);
    if (
      (state.timer?.running && (state.currentSession?.runningSince || state.timer.mode === POMODORO_MODE.BREAK))
      || (state.currentSession?.endedAt && state.currentSession.status === "pending")
      || (state.currentSession?.status === "completed" && state.timer?.mode === POMODORO_MODE.BREAK)
    ) {
      navigation.navigate("pomodoro");
    }
  });

  byId("pomodoro-start").addEventListener("click", () => {
    const session = pomodoroSessions.getCurrentSession();
    if (pomodoroSessions.getState().timer?.mode === POMODORO_MODE.BREAK && !pomodoroSessions.getState().timer.running) {
      runAction(() => pomodoroSessions.resumeBreak());
    } else if (session?.status === "pending" && !session.endedAt) {
      runAction(() => pomodoroSessions.resume(session.taskId, session.id));
    } else if (!session?.endedAt) {
      pomodoro.start();
    }
  });
  byId("pomodoro-pause").addEventListener("click", () => runAction(() => pomodoroSessions.pause()));
  byId("pomodoro-reset").addEventListener("click", () => runAction(() => pomodoroSessions.reset()));

  confirmButton.addEventListener("click", () => {
    const session = pomodoroSessions.getCurrentSession();
    if (session) runAction(
      () => pomodoroSessions.confirm(session.taskId, session.id),
      "Sesión completada y registrada."
    );
  });
  failButton.addEventListener("click", () => {
    const session = pomodoroSessions.getCurrentSession();
    if (!session) return;
    const reason = window.prompt("Motivo de incumplimiento (opcional):");
    if (reason !== null) runAction(
      () => pomodoroSessions.markUnfulfilled(session.taskId, session.id, reason),
      "Sesión registrada como incumplida."
    );
  });

  return async function startPomodoroForTask(taskId, taskTitle, block, scheduleKey) {
    await pomodoroSessions.start(taskId, block, scheduleKey);
    taskLabel.textContent = `Tarea: ${taskTitle} · ${formatShortDateTime(block.start)}`;
    navigation.navigate("pomodoro");
    requestAnimationFrame(() => time.scrollIntoView({ behavior: "smooth", block: "center" }));
  };
}
