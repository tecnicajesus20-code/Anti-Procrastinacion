/** FORMULARIO "NUEVA TAREA" de la tarjeta de tareas. Delega la creación en taskService.add. */
import { byId } from "../../shared/dom.js";
import { runAction } from "../../shared/feedback.js";
import { readTaskInput } from "./task-input.js";
import { initDifficultySelect } from "./difficulty-select.ui.js";

const FIELDS = {
  title: "task-title", description: "task-description", start: "task-start", end: "task-end",
  category: "task-category", difficulty: "task-difficulty",
};

/** @param {ReturnType<import("../../application/task.service.js").createTaskService>} taskService */
export function initTaskForm(taskService) {
  const form = byId("task-form");
  // Dificultad del primer bloque: deshabilita los niveles que no admiten la duración elegida.
  initDifficultySelect({ select: "task-difficulty", start: "task-start", end: "task-end", hint: "task-difficulty-hint" });

  // Evita crear la tarea dos veces si se pulsa "Agregar tarea" varias veces mientras se guarda.
  const submitButton = form.querySelector('button[type="submit"]');
  let saving = false;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (saving) return;
    saving = true;
    if (submitButton) submitButton.disabled = true;
    Promise.resolve(runAction(async () => {
      await taskService.add(readTaskInput(FIELDS));
      form.reset();
    })).finally(() => {
      saving = false;
      if (submitButton) submitButton.disabled = false;
    });
  });
}
