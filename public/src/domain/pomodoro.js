/**
 * DOMINIO DEL POMODORO: modos, duraciones por defecto y transición entre modos.
 * Sin dependencias ni temporizadores (eso vive en application/pomodoro.service.js).
 */
export const POMODORO_MODE = Object.freeze({ WORK: "work", BREAK: "break" });

export const POMODORO_DEFAULTS = Object.freeze({ workSeconds: 25 * 60, breakSeconds: 5 * 60 });

/** Trabajo → descanso → trabajo… */
export const nextMode = (mode) => (mode === POMODORO_MODE.WORK ? POMODORO_MODE.BREAK : POMODORO_MODE.WORK);

export const POMODORO_SESSION_STATUS = Object.freeze({
  PENDING: "pending",
  COMPLETED: "completed",
  UNFULFILLED: "unfulfilled",
});

/**
 * Planea sesiones completas de enfoque dentro del bloque asignado.
 * Los descansos solo se insertan entre sesiones y el tiempo restante menor a 25 minutos se ignora.
 */
export function planPomodoroBlock(block, blockIndex, {
  workSeconds = POMODORO_DEFAULTS.workSeconds,
  breakSeconds = POMODORO_DEFAULTS.breakSeconds,
} = {}) {
  const start = Date.parse(block.start);
  const end = Date.parse(block.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
  if (!Number.isInteger(blockIndex) || blockIndex < 0) throw new RangeError("El índice del bloque no es válido.");
  if (!Number.isFinite(workSeconds) || workSeconds <= 0 || !Number.isFinite(breakSeconds) || breakSeconds < 0) {
    throw new RangeError("Las duraciones Pomodoro no son válidas.");
  }

  const workMs = workSeconds * 1000;
  const breakMs = breakSeconds * 1000;
  const count = Math.floor((end - start + breakMs) / (workMs + breakMs));
  const plan = [];
  let cursor = start;

  for (let sessionIndex = 0; sessionIndex < count; sessionIndex += 1) {
    const focusStart = new Date(cursor).toISOString();
    const focusEnd = new Date(cursor + workMs).toISOString();
    plan.push({
      kind: "focus",
      blockIndex,
      sessionIndex,
      scheduleKey: `${blockIndex}:${focusStart}`,
      start: focusStart,
      end: focusEnd,
      durationSeconds: workSeconds,
    });
    cursor += workMs;

    if (sessionIndex < count - 1) {
      const breakStart = new Date(cursor).toISOString();
      cursor += breakMs;
      plan.push({
        kind: "break",
        blockIndex,
        sessionIndex,
        start: breakStart,
        end: new Date(cursor).toISOString(),
        durationSeconds: breakSeconds,
      });
    }
  }

  return plan;
}

/** Genera el plan Pomodoro de todos los bloques actuales de una tarea. */
export function planPomodoroTask(task, options) {
  const blocks = Array.isArray(task.blocks) && task.blocks.length
    ? task.blocks
    : [{ start: task.start, end: task.end }];
  return blocks.flatMap((block, blockIndex) => planPomodoroBlock(block, blockIndex, options));
}

/**
 * Calcula el cumplimiento sobre el plan actual y conserva sesiones históricas de horarios editados.
 * Las sesiones pendientes cuentan como posibles completadas, pero nunca como completadas de hecho.
 */
export function summarizePomodoroTask(task, sessions = task.pomodoroSessions ?? [], options) {
  const plan = planPomodoroTask(task, options).filter((slot) => slot.kind === "focus");
  const currentKeys = new Set(plan.map((slot) => slot.scheduleKey));
  const historicalKeys = new Set(
    sessions
      .filter((session) => !currentKeys.has(session.scheduleKey))
      .map((session) => session.scheduleKey)
  );
  const total = plan.length + historicalKeys.size;
  const completed = sessions.filter((session) => session.status === POMODORO_SESSION_STATUS.COMPLETED).length;
  const pending = sessions.filter((session) => session.status === POMODORO_SESSION_STATUS.PENDING).length;

  if (total === 0) return { total, completed, completionRate: 0, status: "not_applicable" };

  const required = Math.ceil(total * 0.8);
  const completionRate = Math.floor((completed / total) * 100);
  const status = completed >= required
    ? "fulfilled"
    : completed + pending + Math.max(0, plan.length - sessions.filter((session) => currentKeys.has(session.scheduleKey)).length) < required
      ? "unfulfilled"
      : "pending";

  return { total, completed, completionRate, status };
}
