/** PRESENTACIÓN DEL POMODORO: muestra el tiempo y conecta los botones. */
import { byId } from "../../ui/dom.js";

const pad = (number) => String(number).padStart(2, "0");

/** @param {ReturnType<import("./pomodoro.service.js").createPomodoroService>} pomodoro */
export function initPomodoroUi(pomodoro) {
  const time = byId("pomodoro-time");
  const mode = byId("pomodoro-mode");

  pomodoro.onTick((state) => {
    time.textContent = `${pad(Math.floor(state.remaining / 60))}:${pad(state.remaining % 60)}`;
    mode.textContent = state.mode === "work" ? "Trabajo" : "Descanso";
  });

  byId("pomodoro-start").addEventListener("click", () => pomodoro.start());
  byId("pomodoro-pause").addEventListener("click", () => pomodoro.pause());
  byId("pomodoro-reset").addEventListener("click", () => pomodoro.reset());
}
