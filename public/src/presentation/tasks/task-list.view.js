/**
 * LISTA DE TAREAS: dibuja las tarjetas de taskService. Al hacer clic en una tarjeta se abre su detalle
 * (task-detail-dialog.ui.js) con los bloques de trabajo y las acciones Completar/Reabrir, Editar, Eliminar…
 * No decide reglas de estado: Completar/Reabrir es el caso de uso taskService.toggleDone.
 */
import { byId } from "../../shared/dom.js";
import { getTaskBlocks, isDone, byStart } from "../../domain/task.js";
import { getTaskColor } from "./task-color.js";
import { initTaskDetailDialog } from "./task-detail-dialog.ui.js";

/**
 * @param {ReturnType<import("../../application/task.service.js").createTaskService>} taskService
 * @param {(selection: {taskId: string, blockIndex: number}) => void} editBlockDialog
 * @param {(taskId: string) => void} editTaskDialog
 * @param {(taskId: string) => void} addBlockDialog
 * @param {(taskTitle: string, block: {start: string, end: string}) => void} startPomodoro
 */
export function initTaskList(taskService, editBlockDialog, editTaskDialog, addBlockDialog, startPomodoro) {
  const list = byId("task-list");
  const detail = initTaskDetailDialog(taskService, { editBlockDialog, editTaskDialog, addBlockDialog, startPomodoro });

  const DUE_FORMAT = { weekday: "short", day: "numeric", month: "short" };
  const formatDue = (iso) => new Date(iso).toLocaleDateString("es", DUE_FORMAT).replace(/\./g, "");

  function renderItem(task) {
    const done = isDone(task);
    const item = document.createElement("li");
    item.className = done ? "task-item task-item--done" : "task-item";
    item.style.setProperty("--task-color", getTaskColor(task.id));

    const title = document.createElement("h3");
    title.className = "task-title";
    title.textContent = task.title; // textContent evita inyectar HTML

    const description = document.createElement("p");
    description.className = "task-description";
    description.textContent = task.description || "Sin descripción";

    const blocks = getTaskBlocks(task);
    // Progreso visual: tarea completada = todos los bloques; si no, los bloques cuyo horario ya terminó.
    const doneBlocks = done ? blocks.length : blocks.filter((block) => Date.parse(block.end) <= Date.now()).length;

    const progress = document.createElement("div");
    progress.className = "task-progress";
    progress.setAttribute("role", "progressbar");
    progress.setAttribute("aria-valuemin", "0");
    progress.setAttribute("aria-valuemax", String(blocks.length));
    progress.setAttribute("aria-valuenow", String(doneBlocks));
    const progressFill = document.createElement("i");
    progressFill.className = "task-progress__fill";
    progressFill.style.width = `${(doneBlocks / blocks.length) * 100}%`;
    progress.append(progressFill);

    const meta = document.createElement("div");
    meta.className = "task-meta";
    const count = document.createElement("span");
    count.className = "task-count";
    count.textContent = `${doneBlocks} de ${blocks.length} ${blocks.length === 1 ? "bloque" : "bloques"}`;
    const due = document.createElement("span");
    due.className = "task-chip";
    due.textContent = task.dueDate ? `Vence ${formatDue(task.dueDate)}` : "Sin fecha límite";
    meta.append(count, due);
    const hint = document.createElement("span");
    hint.className = "task-open-hint";
    hint.textContent = "Ver bloques →";
    meta.append(hint);

    // Al hacer clic (o Enter/Espacio) se abre el detalle en una ventana flotante con los bloques de trabajo.
    item.tabIndex = 0;
    item.setAttribute("role", "button");
    item.setAttribute("aria-haspopup", "dialog");
    item.setAttribute("aria-label", `Ver detalle de ${task.title}`);
    item.addEventListener("click", () => detail.open(task.id));
    item.addEventListener("keydown", (event) => {
      if (event.target === item && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        detail.open(task.id);
      }
    });

    item.append(title, description, progress, meta);
    return item;
  }

  function render(tasks) {
    list.replaceChildren(...[...tasks].sort(byStart).map(renderItem));
  }

  taskService.subscribe(render);
}