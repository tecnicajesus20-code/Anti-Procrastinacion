/**
 * Diálogo para crear tareas, editar una tarea existente o añadirle otro bloque horario.
 */
import { confirmDialog } from "../shared/confirm-dialog.ui.js";
import { byId } from "../../shared/dom.js";
import { showMessage, clearMessage, runAction } from "../../shared/feedback.js";
import { dateToLocalInputValue } from "../../shared/date-time.js";
import { getTaskBlocks } from "../../domain/task.js";
import { readTaskInput } from "./task-input.js";
import { initDifficultySelect } from "./difficulty-select.ui.js";

const FIELDS = { title: "event-title", description: "event-description", start: "event-start", end: "event-end" };
const modes = { CREATE: "create", VIEW: "view", EDIT: "edit", ADD_BLOCK: "add-block" };

/**
 * @param {ReturnType<import("../../application/task.service.js").createTaskService>} taskService
 * @param {(taskId: string, taskTitle: string, block: {start: string, end: string}) => Promise<void>} startPomodoro
 * @returns {{
 *   open: (slot: { start: Date, end: Date }) => void,
 *   openTask: (selection: { taskId: string, blockIndex: number }) => void,
 *   editTask: (taskId: string) => void,
 *   editBlock: (selection: { taskId: string, blockIndex: number }) => void,
 *   addBlockToTask: (taskId: string) => void
 * }}
 */
export function initCalendarTaskDialog(taskService, startPomodoro) {
  const dialog = byId("event-dialog");
  const form = byId("event-form");
  const title = byId("event-title");
  const description = byId("event-description");
  const start = byId("event-start");
  const end = byId("event-end");
  const editButton = byId("event-dialog-edit");
  const addBlockButton = byId("event-dialog-add-block");
  const pomodoroButton = byId("event-dialog-pomodoro");
  const deleteBlockButton = byId("event-dialog-delete-block");
  const deleteTaskButton = byId("event-dialog-delete-task");
  const blockHint = byId("event-dialog-block-hint");
  const saveButton = byId("event-dialog-save");
  // Categoría (de la tarea) y dificultad (del bloque). Opcionales al editar tareas antiguas.
  const category = byId("event-category");
  const difficultySelect = byId("event-difficulty");
  const difficulty = initDifficultySelect({ select: "event-difficulty", start: "event-start", end: "event-end", hint: "event-difficulty-hint" });
  let selectedFields = { hadCategory: false, hadDifficulty: false, resolved: false };
  // Si index.html no trae la caja de error (versión anterior), se crea aquí para que la app no se rompa.
  const errorBox = document.getElementById("event-dialog-error") ?? (() => {
    const box = document.createElement("p");
    box.className = "message message--error task-dialog__error";
    box.id = "event-dialog-error";
    box.setAttribute("role", "alert");
    box.hidden = true;
    form.querySelector(".event-dialog__actions").before(box);
    return box;
  })();
  let mode = modes.CREATE;
  let selected = null;
  let selectedBlockCount = 0;

  /** Traduce errores técnicos (Firebase) a un texto que la persona entienda. */
  function describeError(error) {
    if (error?.code === "permission-denied") {
      return "Firebase rechazó el cambio (permiso denegado). Publica las reglas actualizadas con: firebase deploy --only firestore:rules";
    }
    return error?.message || "No se pudo guardar el cambio.";
  }

  /**
   * Ejecuta una acción del diálogo. Si falla, el error se muestra DENTRO de la ventana
   * (antes quedaba escondido detrás del diálogo y parecía que el botón no hacía nada).
   */
  async function runInDialog(action) {
    errorBox.hidden = true;
    try {
      await action();
      clearMessage();
    } catch (error) {
      const text = describeError(error);
      errorBox.textContent = text;
      errorBox.hidden = false;
      showMessage(text, "error");
    }
  }

  dialog.addEventListener("close", () => {
    errorBox.hidden = true;
  });

  function setMode(nextMode) {
    mode = nextMode;
    const viewing = mode === modes.VIEW;
    const addingBlock = mode === modes.ADD_BLOCK;
    title.disabled = viewing || addingBlock;
    description.disabled = viewing || addingBlock;
    start.disabled = viewing;
    end.disabled = viewing;
    editButton.hidden = mode !== modes.VIEW;
    addBlockButton.hidden = mode !== modes.VIEW;
    pomodoroButton.hidden = mode !== modes.VIEW;
    deleteBlockButton.hidden = mode !== modes.VIEW;
    deleteTaskButton.hidden = mode !== modes.VIEW;
    blockHint.hidden = mode !== modes.VIEW || selectedBlockCount !== 1;
    saveButton.hidden = viewing;
    category.disabled = viewing || addingBlock;
    category.required = mode === modes.CREATE || (mode === modes.EDIT && selectedFields.hadCategory);
    // Un bloque con resultado registrado conserva su dificultad (sus puntos ya se calcularon con ella).
    difficultySelect.disabled = viewing || (mode === modes.EDIT && selectedFields.resolved);
    difficultySelect.required = mode === modes.CREATE || addingBlock || (mode === modes.EDIT && selectedFields.hadDifficulty);

    byId("event-dialog-title").textContent = ({
      [modes.CREATE]: "Nueva tarea",
      [modes.VIEW]: "Detalles de tarea",
      [modes.EDIT]: "Editar tarea",
      [modes.ADD_BLOCK]: "Crear otro bloque",
    })[mode];
    saveButton.textContent = addingBlock ? "Crear bloque" : "Guardar";
  }

  /** Abre el diálogo con el hueco seleccionado ya relleno. */
  function open({ start: slotStart, end: slotEnd }) {
    selected = null;
    selectedBlockCount = 0;
    form.reset();
    title.value = "";
    description.value = "";
    blockHint.hidden = true;
    start.value = dateToLocalInputValue(slotStart);
    end.value = dateToLocalInputValue(slotEnd);
    selectedFields = { hadCategory: false, hadDifficulty: false, resolved: false };
    category.value = "";
    difficulty.setValue("");
    setMode(modes.CREATE);
    if (dialog.open && !dialog.matches(":modal")) dialog.close(); // abierta a medias (no modal): showModal fallaría
    if (!dialog.open) dialog.showModal();
    title.focus();
  }

  function openTask({ taskId, blockIndex }, initialMode = modes.VIEW) {
    const task = taskService.getAll().find((candidate) => candidate.id === taskId);
    if (!task) {
      showMessage("No se encontró la tarea seleccionada.", "error");
      return;
    }

    const blocks = getTaskBlocks(task);
    if (!Number.isInteger(blockIndex) || blockIndex < 0 || blockIndex >= blocks.length) {
      showMessage("No se encontró el bloque horario seleccionado.", "error");
      return;
    }

    selected = { taskId, blockIndex };
    selectedBlockCount = blocks.length;
    title.value = task.title;
    description.value = task.description ?? "";
    start.value = dateToLocalInputValue(new Date(blocks[blockIndex].start));
    end.value = dateToLocalInputValue(new Date(blocks[blockIndex].end));
    deleteBlockButton.disabled = blocks.length === 1;
    deleteBlockButton.title = blocks.length === 1
      ? "Agrega otro bloque o elimina la tarea para quitar su único bloque."
      : "";
    blockHint.textContent = blocks.length === 1
      ? "Esta tarea tiene un solo bloque. Agrega otro antes de eliminarlo, o elimina la tarea completa."
      : "";
    blockHint.hidden = blocks.length !== 1;
    selectedFields = {
      hadCategory: Boolean(task.category),
      hadDifficulty: Boolean(blocks[blockIndex].difficulty),
      resolved: Boolean(blocks[blockIndex].outcome),
    };
    category.value = task.category ?? "";
    difficulty.setValue(blocks[blockIndex].difficulty);
    setMode(initialMode);
    dialog.showModal();
  }

  function editTask(taskId) {
    openTask({ taskId, blockIndex: 0 }, modes.EDIT);
  }

  function editBlock(selection) {
    openTask(selection, modes.EDIT);
  }

  function prepareNewBlock(task) {
    const blocks = getTaskBlocks(task).sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
    selected = { taskId: task.id, blockIndex: blocks.length - 1 };
    title.value = task.title;
    description.value = task.description ?? "";
    const suggestedStart = new Date(blocks[blocks.length - 1].end);
    const suggestedEnd = new Date(suggestedStart.getTime() + 60 * 60 * 1000);
    start.value = dateToLocalInputValue(suggestedStart);
    end.value = dateToLocalInputValue(suggestedEnd);
    selectedFields = { hadCategory: Boolean(task.category), hadDifficulty: false, resolved: false };
    category.value = task.category ?? "";
    difficulty.setValue("");
    setMode(modes.ADD_BLOCK);
  }

  function addBlockToTask(taskId) {
    const task = taskService.getAll().find((candidate) => candidate.id === taskId);
    if (!task) {
      showMessage("No se encontró la tarea seleccionada.", "error");
      return;
    }

    selectedBlockCount = getTaskBlocks(task).length;
    prepareNewBlock(task);
    dialog.showModal();
  }

  pomodoroButton.addEventListener("click", () => {
    if (!selected) return;
    const task = taskService.getAll().find((candidate) => candidate.id === selected.taskId);
    if (!task) {
      showMessage("No se encontró la tarea seleccionada.", "error");
      return;
    }

    const block = getTaskBlocks(task)[selected.blockIndex];
    runAction(async () => {
      await startPomodoro(task.id, task.title, block);
      dialog.close();
    });
  });

  editButton.addEventListener("click", () => setMode(modes.EDIT));
  addBlockButton.addEventListener("click", () => {
    const task = taskService.getAll().find((candidate) => candidate.id === selected?.taskId);
    if (!task || !selected) {
      showMessage("No se encontró la tarea seleccionada.", "error");
      return;
    }

    prepareNewBlock(task);
  });

  deleteBlockButton.addEventListener("click", () => {
    if (!selected || deleteBlockButton.disabled) return;
    runInDialog(async () => {
      await taskService.removeBlock(selected.taskId, selected.blockIndex);
      dialog.close();
    });
  });

  deleteTaskButton.addEventListener("click", async () => {
    if (!selected) return;
    const target = selected;
    const ok = await confirmDialog({
      title: "¿Eliminar esta tarea?",
      message: `Se borrarán «${title.value}» y todos sus bloques. Esta acción no se puede deshacer.`,
      confirmText: "Sí, eliminar",
      danger: true,
    });
    if (!ok || selected !== target) return;
    runInDialog(async () => {
      await taskService.remove(selected.taskId);
      dialog.close();
    });
  });

  // Evita guardar dos veces: mientras se guarda (Firestore tarda un momento), los clics extra se ignoran.
  let saving = false;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (mode === modes.VIEW || saving) return;
    saving = true;
    saveButton.disabled = true;
    const saveText = saveButton.textContent;
    saveButton.textContent = "Guardando…";

    runInDialog(async () => {
      const blockFields = difficulty.value() ? { difficulty: difficulty.value() } : {};
      if (mode === modes.CREATE) {
        await taskService.add({ ...readTaskInput(FIELDS), category: category.value, difficulty: difficulty.value() });
      } else if (mode === modes.EDIT && selected) {
        const changes = readTaskInput(FIELDS);
        await taskService.updateBlock(selected.taskId, selected.blockIndex, {
          ...changes,
          title: changes.title.trim(),
          description: changes.description.trim() || null,
          ...(category.value ? { category: category.value } : {}),
        }, selectedFields.resolved ? {} : blockFields);
      } else if (mode === modes.ADD_BLOCK && selected) {
        const { start: blockStart, end: blockEnd } = readTaskInput({ start: FIELDS.start, end: FIELDS.end });
        await taskService.addBlock(selected.taskId, blockStart, blockEnd, blockFields);
      }
      dialog.close();
      form.reset();
    }).finally(() => {
      saving = false;
      saveButton.disabled = false;
      saveButton.textContent = saveText;
    });
  });

  byId("event-dialog-close").addEventListener("click", () => dialog.close());

  return { open, openTask, editTask, editBlock, addBlockToTask };
}
