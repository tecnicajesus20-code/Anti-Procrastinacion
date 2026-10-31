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
  const listeners = new Set();

  const durationOf = (value) => (value === POMODORO_MODE.WORK ? workSeconds : breakSeconds);
  const state = () => ({ mode, remaining, running: timerId !== null });
  const emit = () => listeners.forEach((callback) => callback(state()));

  function stop() {
    clock.clearInterval(timerId);
    timerId = null;
  }

  function tick() {
    remaining -= 1;
    if (remaining <= 0) {
      stop(); // al terminar un periodo, se cambia de modo y se espera a que el usuario continúe
      mode = nextMode(mode);
      remaining = durationOf(mode);
    }
    emit();
  }

  function start() {
    if (timerId !== null) return;
    timerId = clock.setInterval(tick, 1000);
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
    emit();
  }

  function onTick(callback) {
    listeners.add(callback);
    callback(state());
    return () => listeners.delete(callback);
  }

  return { start, pause, reset, onTick };
}
