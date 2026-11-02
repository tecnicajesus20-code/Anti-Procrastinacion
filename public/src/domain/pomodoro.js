/**
 * DOMINIO DEL POMODORO: modos, duraciones por defecto y transición entre modos.
 * Sin dependencias ni temporizadores (eso vive en application/pomodoro.service.js).
 */
export const POMODORO_MODE = Object.freeze({ WORK: "work", BREAK: "break" });

export const POMODORO_DEFAULTS = Object.freeze({ workSeconds: 25 * 60, breakSeconds: 5 * 60 });

/** Trabajo → descanso → trabajo… */
export const nextMode = (mode) => (mode === POMODORO_MODE.WORK ? POMODORO_MODE.BREAK : POMODORO_MODE.WORK);
