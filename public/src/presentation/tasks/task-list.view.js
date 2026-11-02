/**
 * LISTA DE TAREAS: dibuja las tareas de taskService y conecta Completar/Reabrir y Eliminar.
 * No decide reglas de estado: Completar/Reabrir es el caso de uso taskService.toggleDone.
 */
import { byId } from "../../shared/dom.js";
import { runAction } from "../../shared/feedback.js";
import { formatShortDateTime } from "../../shared/date-time.js";
import { getTaskBlocks, isDone, byStart } from "../../domain/task.js";
import { getTaskColor } from "./task-color.js";

function createButton(className, text, onClick, { disabled = false, title = "" } = {}) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = text;
  button.disabled = disabled;
  button.title = title;
  button.addEventListener("click", onClick);
  return button;
}

/**
 * @param {ReturnType<import("../../application/task.service.js").createTaskService>} taskService
 * @param {(selection: {taskId: string, blockIndex: number}) => void} editBlockDialog
 * @param {(taskId: string) => void} editTaskDialog
 * @param {(taskId: string) => void} addBlockDialog
 * @param {(taskTitle: string, block: {start: string, end: string}) => void} startPomodoro
 */
export function initTaskList(taskService, editBlockDialog, editTaskDialog, addBlockDialog, startPomodoro) {
  const list = byId("task-list");

  function renderItem(task) {
    const done = isDone(task);
    const item = document.createElement("li");
    item.className = done ? "task-item task-item--done" : "task-item";
    item.style.setProperty("--task-color", getTaskColor(task.id));

    const title = document.createElement("span");
    title.className = "task-title";
    title.textContent = task.title; // textContent evita inyectar HTML

    const blocks = getTaskBlocks(task);
    const blockList = document.createElement("ul");
    blockList.className = "task-block-list";
    blocks.forEach((block, blockIndex) => {
      const blockItem = document.createElement("li");
      blockItem.className = "task-block-item";
      const time = document.createElement("span");
      time.className = "task-time";
      time.textContent = `${formatShortDateTime(block.start)} → ${formatShortDateTime(block.end)}`;

      const blockActions = document.createElement("div");
      blockActions.className = "btn-row task-block-actions";
      blockActions.append(
        createButton("btn", "Editar bloque", () => editBlockDialog({ taskId: task.id, blockIndex })),
        createButton("btn btn--pomodoro", "Iniciar Pomodoro", () => startPomodoro(task.title, block)),
        createButton(
          "btn btn--danger",
          "Eliminar bloque",
          () => runAction(() => taskService.removeBlock(task.id, blockIndex)),
          {
            disabled: blocks.length === 1,
            title: blocks.length === 1 ? "Agrega otro bloque o elimina la tarea para quitar su único bloque." : "",
          }
        )
      );
      blockItem.append(time, blockActions);
      blockList.append(blockItem);
    });
    const blockHint = blocks.length === 1 ? document.createElement("p") : null;
    if (blockHint) {
      blockHint.className = "task-block-hint";
      blockHint.textContent = "Para quitar el único bloque, agrega otro bloque o elimina la tarea.";
    }

    const actions = document.createElement("div");
    actions.className = "btn-row";
    actions.append(
      createButton("btn", "Editar tarea", () => editTaskDialog(task.id)),
      createButton("btn", "Agregar bloque", () => addBlockDialog(task.id)),
      createButton("btn", done ? "Reabrir" : "Completar", () => runAction(() => taskService.toggleDone(task.id))),
      createButton("btn btn--danger", "Eliminar", () => runAction(() => taskService.remove(task.id)))
    );

    item.append(title, blockList);
    if (blockHint) item.append(blockHint);
    item.append(actions);
    return item;
  }

  function render(tasks) {
    list.replaceChildren(...[...tasks].sort(byStart).map(renderItem));
  }

  taskService.subscribe(render);
}
