/**
 * INICIO DE BLOQUE: ventana "Define una tarea concreta para realizar en este bloque de tiempo".
 * Solo presentación: devuelve el texto (o null si se cancela). Quien la llama decide guardarlo
 * (block-outcome.service.defineIntent) y luego iniciar el bloque con el flujo de siempre.
 */
import { byId } from "../../shared/dom.js";
import { formatShortDateTime, formatClock } from "../../shared/date-time.js";

/** @returns {(request: {taskTitle: string, block: {start: string, end: string}}) => Promise<string|null>} */
export function initBlockIntentDialog() {
  const dialog = byId("block-intent-dialog");
  const form = byId("block-intent-form");
  const taskLabel = byId("block-intent-task");
  const timeLabel = byId("block-intent-time");
  const text = byId("block-intent-text");
  let settle = null;

  function finish(value) {
    const done = settle;
    settle = null;
    if (dialog.open) dialog.close();
    done?.(value);
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = text.value.trim();
    if (!value) {
      text.setCustomValidity("Escribe qué harás en este bloque.");
      text.reportValidity();
      return;
    }
    finish(value);
  });
  text.addEventListener("input", () => text.setCustomValidity(""));
  byId("block-intent-cancel").addEventListener("click", () => finish(null));
  dialog.addEventListener("close", () => finish(null)); // Escape también cancela

  return function askIntent({ taskTitle, block }) {
    if (settle) finish(null); // una petición anterior sin responder se cancela
    form.reset();
    taskLabel.textContent = taskTitle;
    timeLabel.textContent = `Bloque: ${formatShortDateTime(block.start)} a ${formatClock(block.end)}`;
    dialog.showModal();
    text.focus();
    return new Promise((resolve) => { settle = resolve; });
  };
}
