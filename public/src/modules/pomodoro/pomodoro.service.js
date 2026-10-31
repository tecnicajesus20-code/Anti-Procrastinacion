/**
 * LÓGICA DEL POMODORO (sin DOM). Alterna trabajo (25 min) y descanso (5 min).
 * Nota: si la pestaña queda en segundo plano el navegador puede retrasar el reloj;
 * es una limitación aceptada en el MVP.
 *
 * API pública: start(), pause(), reset(), onTick(callback)
 *   callback recibe { mode: "work"|"break", remaining: segundos, running: boolean }
 */
export function createPomodoroService({ workSeconds = 25 * 60, breakSeconds = 5 * 60 } = {}) {
  let mode = "work";
  let remaining = workSeconds;
  let timerId = null;
  const listeners = new Set();

  const durationOf = (value) => (value === "work" ? workSeconds : breakSeconds);
  const state = () => ({ mode, remaining, running: timerId !== null });
  const emit = () => listeners.forEach((callback) => callback(state()));

  function stop() {
    clearInterval(timerId);
    timerId = null;
  }

  function tick() {
    remaining -= 1;
    if (remaining <= 0) {
      stop(); // al terminar un periodo, se cambia de modo y se espera a que el usuario continúe
      mode = mode === "work" ? "break" : "work";
      remaining = durationOf(mode);
    }
    emit();
  }

  function start() {
    if (timerId !== null) return;
    timerId = setInterval(tick, 1000);
    emit();
  }

  function pause() {
    stop();
    emit();
  }

  function reset() {
    stop();
    mode = "work";
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
