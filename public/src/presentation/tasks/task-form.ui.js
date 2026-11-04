/** FORMULARIO "NUEVA TAREA" de la tarjeta de tareas. Delega la creación en taskService.add. */
import { byId } from "../../shared/dom.js";
import { runAction } from "../../shared/feedback.js";
import { readTaskInput } from "./task-input.js";
import { initDifficultySelect } from "./difficulty-select.ui.js";

const FIELDS = {
  title: "task-title", description: "task-description", dueDate: "task-due", start: "task-start", end: "task-end",
  category: "task-category", difficulty: "task-difficulty",
};

/** @param {ReturnType<import("../../application/task.service.js").createTaskService>} taskService */
export function initTaskForm(taskService) {
  const form = byId("task-form");
  // Dificultad del primer bloque: deshabilita los niveles que no admiten la duración elegida.
  initDifficultySelect({ select: "task-difficulty", start: "task-start", end: "task-end", hint: "task-difficulty-hint" });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    runAction(async () => {
      await taskService.add(readTaskInput(FIELDS));
      form.reset();
    });
  });
}
