/** PRESENTACIÓN DEL POMODORO: muestra el tiempo y conecta los botones. */
import { byId } from "../../shared/dom.js";
import { formatMinutesSeconds } from "../../shared/date-time.js";
import { POMODORO_MODE, POMODORO_DEFAULTS } from "../../domain/pomodoro.js";
import { formatMinutesSeconds, formatShortDateTime } from "../../shared/date-time.js";
import { POMODORO_MODE } from "../../domain/pomodoro.js";

const MODE_LABELS = { [POMODORO_MODE.WORK]: "Trabajo", [POMODORO_MODE.BREAK]: "Descanso" };
/** Duración total de cada modo, solo para calcular cuánto del anillo queda lleno (apariencia). */
const MODE_TOTALS = { [POMODORO_MODE.WORK]: POMODORO_DEFAULTS.workSeconds, [POMODORO_MODE.BREAK]: POMODORO_DEFAULTS.breakSeconds };

/** @param {ReturnType<import("../../application/pomodoro.service.js").createPomodoroService>} pomodoro */
export function initPomodoroUi(pomodoro) {
  const time = byId("pomodoro-time");
  const mode = byId("pomodoro-mode");
  const card = byId("pomodoro-card");
  const ring = byId("pomodoro-ring");
  const taskLabel = byId("pomodoro-task");
  let activeTask = "";

  function startForTask(taskTitle, block) {
    activeTask = taskTitle;
    const blockTime = block
      ? ` · ${formatShortDateTime(block.start)} → ${formatShortDateTime(block.end)}`
      : "";
    taskLabel.textContent = `Tarea: ${activeTask}${blockTime}`;
    pomodoro.start();
    byId("pomodoro-time").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  pomodoro.onTick((state) => {
    time.textContent = formatMinutesSeconds(state.remaining);
    mode.textContent = MODE_LABELS[state.mode];

    // Solo apariencia: el anillo se vacía con el tiempo (trazo de longitud 1, ver pathLength en index.html)
    // y la tarjeta cambia de color en el descanso y "respira" mientras corre.
    const total = Math.max(MODE_TOTALS[state.mode], state.remaining);
    ring.style.setProperty("stroke-dashoffset", String(1 - state.remaining / total));
    card.classList.toggle("pomodoro--break", state.mode === POMODORO_MODE.BREAK);
    card.classList.toggle("pomodoro--running", state.running);
  });

  byId("pomodoro-start").addEventListener("click", () => pomodoro.start());
  byId("pomodoro-pause").addEventListener("click", () => pomodoro.pause());
  byId("pomodoro-reset").addEventListener("click", () => {
    activeTask = "";
    taskLabel.textContent = "Sin tarea seleccionada";
    pomodoro.reset();
  });

  return startForTask;
}
