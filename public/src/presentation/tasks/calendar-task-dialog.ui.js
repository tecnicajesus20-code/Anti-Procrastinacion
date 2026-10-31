/**
 * DIÁLOGO "NUEVA TAREA" que se abre al seleccionar un hueco del calendario.
 * Usa el mismo caso de uso que el formulario de la lista (taskService.add).
 */
import { byId } from "../../shared/dom.js";
import { runAction } from "../../shared/feedback.js";
import { dateToLocalInputValue } from "../../shared/date-time.js";
import { readTaskInput } from "./task-input.js";

const FIELDS = { title: "event-title", description: "event-description", start: "event-start", end: "event-end" };

/**
 * @param {ReturnType<import("../../application/task.service.js").createTaskService>} taskService
 * @returns {{ open: (slot: { start: Date, end: Date }) => void }}
 */
export function initCalendarTaskDialog(taskService) {
  const dialog = byId("event-dialog");
  const form = byId("event-form");

  /** Abre el diálogo con el hueco seleccionado ya relleno. */
  function open({ start, end }) {
    byId("event-title").value = "";
    byId("event-description").value = "";
    byId("event-start").value = dateToLocalInputValue(start);
    byId("event-end").value = dateToLocalInputValue(end);
    dialog.showModal();
    byId("event-title").focus();
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    runAction(async () => {
      await taskService.add(readTaskInput(FIELDS));
      dialog.close();
      form.reset();
    });
  });

  byId("event-dialog-close").addEventListener("click", () => dialog.close());
  byId("event-dialog-cancel").addEventListener("click", () => dialog.close());

  return { open };
}
