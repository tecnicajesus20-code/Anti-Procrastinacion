/**
 * DETALLE DE TAREA (overlay): se abre al hacer clic en una tarjeta de la lista.
 * Muestra título, descripción, horario, fecha límite y los BLOQUES DE TRABAJO en orden cronológico,
 * cada uno con su botón "Enfocar". Solo presentación: las acciones reutilizan los mismos casos de uso
 * y los mismos diálogos de siempre (editar tarea/bloque, agregar bloque, completar, eliminar).
 */
import { byId } from "../../shared/dom.js";
import { runAction } from "../../shared/feedback.js";
import { formatClock, formatDayShort } from "../../shared/date-time.js";
import { getTaskBlocks, isDone } from "../../domain/task.js";
import { buildWorkBlocks, BLOCK_DURATION_OPTIONS, WORK_BLOCK_DEFAULTS } from "../../domain/work-blocks.js";
import { getTaskColor } from "./task-color.js";

const day = (iso) => formatDayShort(iso).replace(/\./g, "");
const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
const formatRange = ({ start, end }) => (sameDay(start, end)
  ? `${day(start)}, ${formatClock(start)} a ${formatClock(end)}`
  : `${day(start)}, ${formatClock(start)} → ${day(end)}, ${formatClock(end)}`);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(className, text, onClick, { disabled = false, title = "" } = {}) {
  const node = el("button", className, text);
  node.type = "button";
  node.disabled = disabled;
  node.title = title;
  node.addEventListener("click", onClick);
  return node;
}

/**
 * @param {ReturnType<import("../../application/task.service.js").createTaskService>} taskService
 * @param {{
 *   editBlockDialog: (selection: {taskId: string, blockIndex: number}) => void,
 *   editTaskDialog: (taskId: string) => void,
 *   addBlockDialog: (taskId: string) => void,
 *   startPomodoro: (taskTitle: string, block: {start: string, end: string}) => void
 * }} actions
 * @returns {{ open: (taskId: string) => void }}
 */
export function initTaskDetailDialog(taskService, { editBlockDialog, editTaskDialog, addBlockDialog, startPomodoro }) {
  const dialog = byId("task-detail-dialog");
  const titleEl = byId("task-detail-title");
  const descriptionEl = byId("task-detail-description");
  const whenEl = byId("task-detail-when");
  const dueEl = byId("task-detail-due");
  const durationSelect = byId("task-detail-duration");
  const reorganizeButton = byId("task-detail-reorganize");
  const noteEl = byId("task-detail-note");
  const timeline = byId("task-detail-blocks");
  const actionsEl = byId("task-detail-actions");

  const durations = new Map(); // taskId → minutos elegidos (solo apariencia, no se guarda)
  const reorganized = new Map(); // taskId → instante desde el que se reorganizó (solo apariencia)
  let currentId = null;

  durationSelect.replaceChildren(...BLOCK_DURATION_OPTIONS.map((minutes) => {
    const option = el("option", "", String(minutes));
    option.value = String(minutes);
    return option;
  }));

  /** Sale del overlay y ejecuta una acción que abre otra ventana (para no apilar diálogos). */
  const thenClose = (fn) => () => {
    dialog.close();
    fn();
  };

  /**
   * Igual que thenClose, pero cuando se cierra la otra ventana (guardar o cancelar) vuelve a abrir
   * este detalle con los datos actualizados (ej. el bloque recién agregado ya aparece en la lista).
   */
  const thenReturn = (taskId, fn) => () => {
    dialog.close();
    fn();
    const editor = byId("event-dialog");
    if (!editor.open) return; // la otra ventana no se abrió (p. ej. tarea no encontrada)
    editor.addEventListener("close", () => {
      if (taskService.getAll().some((candidate) => candidate.id === taskId)) open(taskId);
    }, { once: true });
  };

  function renderWorkBlock(task, block, number, past) {
    const item = el("li", past ? "work-block work-block--past" : "work-block");
    const badge = el("span", "work-block__number", past ? "✓" : String(number));
    badge.setAttribute("aria-hidden", "true");
    const info = el("div", "work-block__info");
    info.append(
      el("span", "work-block__time", `${formatClock(block.start)} a ${formatClock(block.end)}`),
      el("span", "work-block__sub", `${day(block.start)} · ${block.minutes} min`)
    );
    const focus = button("work-block__focus", "▶ Enfocar", thenClose(() => {
      startPomodoro(task.title, { start: block.start, end: block.end });
      window.location.hash = "pomodoro";
    }));
    focus.setAttribute("aria-label", `Enfocar bloque ${number}: ${formatClock(block.start)} a ${formatClock(block.end)}`);
    item.append(badge, info, focus);
    return item;
  }

  function render() {
    const task = taskService.getAll().find((candidate) => candidate.id === currentId);
    if (!task) {
      if (dialog.open) dialog.close();
      return;
    }
    const done = isDone(task);
    const blocks = getTaskBlocks(task)
      .map((block, index) => ({ ...block, index }))
      .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
    const blockMinutes = durations.get(task.id) ?? WORK_BLOCK_DEFAULTS.blockMinutes;
    const reorganizeFrom = reorganized.get(task.id) ?? null;
    const now = Date.now();

    dialog.style.setProperty("--task-color", getTaskColor(task.id));
    dialog.classList.toggle("task-detail--done", done);
    titleEl.textContent = task.title;
    descriptionEl.textContent = task.description || "Sin descripción";
    descriptionEl.classList.toggle("task-detail__description--empty", !task.description);
    whenEl.textContent = blocks.length === 1
      ? formatRange(blocks[0])
      : `${formatRange(blocks[0])} · ${blocks.length} horarios`;
    dueEl.textContent = task.dueDate ? `Vence ${day(task.dueDate)}` : "Sin fecha límite";
    durationSelect.value = String(blockMinutes);

    // Bloques de trabajo de cada horario, numerados en orden cronológico.
    const items = [];
    let number = 0;
    let hidden = 0;
    blocks.forEach((scheduleBlock) => {
      if (blocks.length > 1) {
        const header = el("li", "work-group");
        header.append(el("span", "work-group__label", `Horario · ${formatRange(scheduleBlock)}`));
        const groupActions = el("span", "work-group__actions");
        groupActions.append(
          button("work-group__btn", "Editar", thenReturn(task.id, () => editBlockDialog({ taskId: task.id, blockIndex: scheduleBlock.index }))),
          button("work-group__btn work-group__btn--danger", "Eliminar", () => runAction(() => taskService.removeBlock(task.id, scheduleBlock.index)))
        );
        header.append(groupActions);
        items.push(header);
      }

      const from = reorganizeFrom && reorganizeFrom > Date.parse(scheduleBlock.start) && reorganizeFrom < Date.parse(scheduleBlock.end)
        ? new Date(Math.ceil(reorganizeFrom / 300_000) * 300_000).toISOString() // siguiente múltiplo de 5 min
        : scheduleBlock.start;
      if (reorganizeFrom && Date.parse(scheduleBlock.end) <= reorganizeFrom) return; // horario ya pasado: se omite
      const { blocks: workBlocks, total } = buildWorkBlocks({ start: from, end: scheduleBlock.end }, { blockMinutes });
      hidden += total - workBlocks.length;
      workBlocks.forEach((workBlock) => {
        number += 1;
        items.push(renderWorkBlock(task, workBlock, number, done || Date.parse(workBlock.end) <= now));
      });
    });

    if (!number) items.push(el("li", "work-empty", reorganizeFrom ? "No quedan bloques pendientes en el horario de esta tarea." : "Esta tarea no tiene bloques de trabajo."));
    timeline.replaceChildren(...items);

    const notes = [];
    if (number) notes.push(`${number} ${number === 1 ? "bloque" : "bloques"} de ${blockMinutes} min con 5 min de pausa`);
    if (reorganizeFrom) notes.push(`reorganizado desde las ${formatClock(new Date(reorganizeFrom).toISOString())}`);
    if (hidden) notes.push(`${hidden} más no se muestran`);
    noteEl.textContent = notes.join(" · ");

    actionsEl.replaceChildren(
      button("btn btn--danger", "Eliminar", () => runAction(async () => {
        await taskService.remove(task.id);
        dialog.close();
      })),
      button("btn", "Agregar bloque", thenReturn(task.id, () => addBlockDialog(task.id))),
      button("btn", "Editar tarea", thenReturn(task.id, () => editTaskDialog(task.id))),
      button("btn btn--primary", done ? "Reabrir" : "Completar", () => runAction(() => taskService.toggleDone(task.id)))
    );
  }

  function open(taskId) {
    currentId = taskId;
    reorganized.delete(taskId);
    render();
    if (!dialog.open) dialog.showModal();
    timeline.scrollTop = 0;
  }

  durationSelect.addEventListener("change", () => {
    if (!currentId) return;
    durations.set(currentId, Number(durationSelect.value));
    render();
  });
  reorganizeButton.addEventListener("click", () => {
    if (!currentId) return;
    durations.set(currentId, Number(durationSelect.value));
    reorganized.set(currentId, Date.now());
    render();
  });
  byId("task-detail-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close(); // clic sobre el fondo oscuro
  });
  dialog.addEventListener("close", () => {
    currentId = null;
  });

  // Los errores de las acciones (feedback.js los escribe en #message) se repiten dentro del detalle,
  // porque el aviso general queda tapado por la ventana.
  const globalMessage = byId("message");
  // Si index.html no trae la caja de error (versión anterior), se crea aquí para que la app no se rompa.
  const errorBox = document.getElementById("task-detail-error") ?? (() => {
    const box = document.createElement("p");
    box.className = "message message--error task-dialog__error task-detail__error";
    box.id = "task-detail-error";
    box.setAttribute("role", "alert");
    box.hidden = true;
    actionsEl.before(box);
    return box;
  })();
  new MutationObserver(() => {
    const isError = !globalMessage.hidden && globalMessage.classList.contains("message--error");
    errorBox.hidden = !(dialog.open && isError);
    if (!errorBox.hidden) errorBox.textContent = globalMessage.textContent;
  }).observe(globalMessage, { attributes: true, childList: true, characterData: true, subtree: true });
  dialog.addEventListener("close", () => {
    errorBox.hidden = true;
  });

  // Si la tarea cambia mientras el detalle está abierto (completar, eliminar bloque…), se redibuja.
  taskService.subscribe(() => {
    if (dialog.open && currentId) render();
  });

  return { open };
}
