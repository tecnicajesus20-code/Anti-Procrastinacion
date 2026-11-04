/**
 * TEMPORIZADOR POMODORO (sin DOM). Alterna trabajo (25 min) y descanso (5 min).
 * Independiente del módulo de tareas.
 * Nota: si la pestaña queda en segundo plano el navegador puede retrasar el reloj;
 * es una limitación aceptada en el MVP.
 *
 * API pública: start(), pause(), reset(), onTick(callback)
 *   callback recibe { mode: "work"|"break", remaining: segundos, running: boolean }
 *
 * `clock` permite inyectar un reloj en pruebas; por defecto usa setInterval/clearInterval globales.
 */
import { POMODORO_MODE, POMODORO_DEFAULTS, nextMode } from "../domain/pomodoro.js";

export function createPomodoroService({
  workSeconds = POMODORO_DEFAULTS.workSeconds,
  breakSeconds = POMODORO_DEFAULTS.breakSeconds,
  clock = { setInterval: (fn, ms) => setInterval(fn, ms), clearInterval: (id) => clearInterval(id) },
} = {}) {
  let mode = POMODORO_MODE.WORK;
  let remaining = workSeconds;
  let timerId = null;
  let awaitingConfirmation = false;
  let confirmationRequired = false;
  const listeners = new Set();

  const durationOf = (value) => (value === POMODORO_MODE.WORK ? workSeconds : breakSeconds);
  const state = () => ({
    mode,
    remaining,
    running: timerId !== null,
    ...(awaitingConfirmation ? { awaitingConfirmation: true } : {}),
  });
  const emit = () => listeners.forEach((callback) => callback(state()));

  function stop() {
    clock.clearInterval(timerId);
    timerId = null;
  }

  function tick() {
    remaining -= 1;
    if (remaining <= 0) {
      stop();
      if (mode === POMODORO_MODE.WORK && confirmationRequired) {
        remaining = 0;
        awaitingConfirmation = true;
        emit();
        return;
      }
      mode = nextMode(mode);
      remaining = durationOf(mode);
      awaitingConfirmation = false;
      emit();
      return;
    }
    emit();
  }

  function start() {
    if (timerId !== null || awaitingConfirmation) return;
    timerId = clock.setInterval(tick, 1000);
    emit();
  }

  function startWorkSession({ remainingSeconds = workSeconds } = {}) {
    if (!Number.isFinite(remainingSeconds) || remainingSeconds <= 0 || remainingSeconds > workSeconds) {
      throw new RangeError("El tiempo restante de la sesión no es válido.");
    }
    stop();
    mode = POMODORO_MODE.WORK;
    remaining = Math.ceil(remainingSeconds);
    awaitingConfirmation = false;
    confirmationRequired = true;
    start();
  }

  function startBreak({ remainingSeconds = breakSeconds, running = true } = {}) {
    if (!Number.isFinite(remainingSeconds) || remainingSeconds <= 0 || remainingSeconds > breakSeconds) {
      throw new RangeError("El tiempo restante del descanso no es válido.");
    }
    stop();
    mode = POMODORO_MODE.BREAK;
    remaining = Math.ceil(remainingSeconds);
    awaitingConfirmation = false;
    confirmationRequired = false;
    if (running) start();
    else emit();
  }

  function awaitWorkConfirmation() {
    stop();
    mode = POMODORO_MODE.WORK;
    remaining = 0;
    awaitingConfirmation = true;
    confirmationRequired = true;
    emit();
  }

  function pause() {
    stop();
    emit();
  }

  function reset() {
    stop();
    mode = POMODORO_MODE.WORK;
    remaining = workSeconds;
    awaitingConfirmation = false;
    confirmationRequired = false;
    emit();
  }

  function onTick(callback) {
    listeners.add(callback);
    callback(state());
    return () => listeners.delete(callback);
  }

  return { start, startWorkSession, startBreak, awaitWorkConfirmation, pause, reset, onTick };
}
