/**
 * LISTA DE TAREAS: dibuja las tareas de taskService y conecta Completar/Reabrir y Eliminar.
 * No decide reglas de estado: Completar/Reabrir es el caso de uso taskService.toggleDone.
 */
import { byId } from "../../shared/dom.js";
import { runAction } from "../../shared/feedback.js";
import { formatShortDateTime } from "../../shared/date-time.js";
import { isDone, byStart } from "../../domain/task.js";

function createButton(className, text, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = text;
  button.addEventListener("click", onClick);
  return button;
}

/** @param {ReturnType<import("../../application/task.service.js").createTaskService>} taskService */
export function initTaskList(taskService) {
  const list = byId("task-list");

  function renderItem(task) {
    const done = isDone(task);
    const item = document.createElement("li");
    item.className = done ? "task-item task-item--done" : "task-item";

    const title = document.createElement("span");
    title.className = "task-title";
    title.textContent = task.title; // textContent evita inyectar HTML

    const time = document.createElement("span");
    time.className = "task-time";
    time.textContent = `${formatShortDateTime(task.start)} → ${formatShortDateTime(task.end)}`;

    const actions = document.createElement("div");
    actions.className = "btn-row";
    actions.append(
      createButton("btn", done ? "Reabrir" : "Completar", () => runAction(() => taskService.toggleDone(task.id))),
      createButton("btn btn--danger", "Eliminar", () => runAction(() => taskService.remove(task.id)))
    );

    item.append(title, time, actions);
    return item;
  }

  function render(tasks) {
    list.replaceChildren(...[...tasks].sort(byStart).map(renderItem));
  }

  taskService.subscribe(render);
}
