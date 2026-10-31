/** PRESENTACIÓN DEL POMODORO: muestra el tiempo y conecta los botones. */
import { byId } from "../../shared/dom.js";
import { formatMinutesSeconds } from "../../shared/date-time.js";
import { POMODORO_MODE } from "../../domain/pomodoro.js";

const MODE_LABELS = { [POMODORO_MODE.WORK]: "Trabajo", [POMODORO_MODE.BREAK]: "Descanso" };

/** @param {ReturnType<import("../../application/pomodoro.service.js").createPomodoroService>} pomodoro */
export function initPomodoroUi(pomodoro) {
  const time = byId("pomodoro-time");
  const mode = byId("pomodoro-mode");

  pomodoro.onTick((state) => {
    time.textContent = formatMinutesSeconds(state.remaining);
    mode.textContent = MODE_LABELS[state.mode];
  });

  byId("pomodoro-start").addEventListener("click", () => pomodoro.start());
  byId("pomodoro-pause").addEventListener("click", () => pomodoro.pause());
  byId("pomodoro-reset").addEventListener("click", () => pomodoro.reset());
}
