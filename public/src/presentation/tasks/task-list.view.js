/**
 * LISTA DE TAREAS: dibuja tarjetas y conecta las acciones con sus casos de uso.
 * No decide reglas de estado: Completar/Reabrir es el caso de uso taskService.toggleDone.
 */
import { promptDialog } from "../shared/confirm-dialog.ui.js";
import { byId } from "../../shared/dom.js";
import { runAction } from "../../shared/feedback.js";
import { formatShortDateTime } from "../../shared/date-time.js";
import { getTaskBlocks, isDone, byStart } from "../../domain/task.js";
import { POMODORO_SESSION_STATUS, summarizePomodoroTask } from "../../domain/pomodoro.js";
import { getTaskColor } from "./task-color.js";
import { initTaskDetailDialog } from "./task-detail-dialog.ui.js";
import { resolveTaskCategory } from "../../domain/category.js";

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
 * @param {(taskId: string, taskTitle: string, block: {start: string, end: string}, scheduleKey?: string) => Promise<void>} startPomodoro
 * @param {ReturnType<import("../../application/pomodoro-session.service.js").createPomodoroSessionService>} pomodoroSessions
 * @param {{ blockOutcomes?: object, getCategories?: () => import("../../domain/category.js").Category[], subscribeCategories?: (cb: () => void) => void }} [extras]
 *   Opcional (categorías y resultado por bloque). Último parámetro para no alterar los anteriores.
 */
export function initTaskList(taskService, editBlockDialog, editTaskDialog, addBlockDialog, startPomodoro, pomodoroSessions, extras = {}) {
  const list = byId("task-list");
  const { blockOutcomes = null, getCategories = () => [] } = extras;
  const detail = initTaskDetailDialog(taskService, { editBlockDialog, editTaskDialog, addBlockDialog, startPomodoro, blockOutcomes, getCategories });

  function renderItem(task) {
    const done = isDone(task);
    const item = document.createElement("li");
    item.className = done ? "task-item task-item--done" : "task-item";
    item.style.setProperty("--task-color", getTaskColor(task.id));

    const title = document.createElement("h3");
    title.className = "task-title";
    title.textContent = task.title;

    const description = document.createElement("p");
    description.className = "task-description";
    description.textContent = task.description || "Sin descripción";

    const blocks = getTaskBlocks(task);
    const doneBlocks = done ? blocks.length : blocks.filter((block) => Date.parse(block.end) <= Date.now()).length;

    const progress = document.createElement("div");
    progress.className = "task-progress";
    progress.setAttribute("role", "progressbar");
    progress.setAttribute("aria-valuemin", "0");
    progress.setAttribute("aria-valuemax", String(blocks.length));
    progress.setAttribute("aria-valuenow", String(doneBlocks));
    const progressFill = document.createElement("i");
    progressFill.className = "task-progress__fill";
    progressFill.style.width = `${blocks.length ? (doneBlocks / blocks.length) * 100 : 0}%`;
    progress.append(progressFill);

    const meta = document.createElement("div");
    meta.className = "task-meta";
    const count = document.createElement("span");
    count.className = "task-count";
    count.textContent = `${doneBlocks} de ${blocks.length} ${blocks.length === 1 ? "bloque" : "bloques"}`;
    const hint = document.createElement("span");
    hint.className = "task-open-hint";
    hint.textContent = "Ver bloques →";
    const category = resolveTaskCategory(task, getCategories());
    if (category) {
      const chip = document.createElement("span");
      chip.className = "task-chip task-chip--category";
      chip.style.setProperty("--category-color", category.color);
      chip.textContent = `${category.icon} ${category.name}`;
      meta.append(count, chip, hint);
    } else {
      meta.append(count, hint);
    }

    item.tabIndex = 0;
    item.setAttribute("aria-label", `Ver detalle de ${task.title}`);
    item.setAttribute("aria-haspopup", "dialog");
    item.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      detail.open(task.id);
    });
    item.addEventListener("keydown", (event) => {
      if (event.target === item && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        detail.open(task.id);
      }
    });

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
        createButton("btn btn--pomodoro", "Iniciar siguiente enfoque", () => runAction(
          () => startPomodoro(task.id, task.title, block)
        )),
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

    const pomodoroSection = document.createElement("section");
    pomodoroSection.className = "task-pomodoro";
    const summary = summarizePomodoroTask(task);
    const statusLabels = {
      not_applicable: "Sin sesiones: el bloque es menor a 25 minutos",
      pending: "En curso",
      fulfilled: "Cumplida",
      unfulfilled: "Incumplida",
    };
    const summaryText = document.createElement("p");
    summaryText.className = `task-pomodoro-summary task-pomodoro-summary--${summary.status}`;
    summaryText.textContent = summary.total
      ? `Enfoque: ${summary.completed}/${summary.total} sesiones · ${summary.completionRate}% · ${statusLabels[summary.status]}`
      : statusLabels[summary.status];
    pomodoroSection.append(summaryText);

    const sessionList = document.createElement("ul");
    sessionList.className = "task-pomodoro-sessions";
    const sessionStatusLabels = {
      pending: "Pendiente de confirmación",
      completed: "Completada",
      unfulfilled: "Incumplida",
    };
    const active = pomodoroSessions.getState().currentSession;
    for (const session of task.pomodoroSessions ?? []) {
      const sessionItem = document.createElement("li");
      sessionItem.className = `task-pomodoro-session task-pomodoro-session--${session.status}`;
      const details = document.createElement("span");
      const actual = Math.round(session.actualDurationSeconds / 60);
      details.textContent = `${sessionStatusLabels[session.status]} · ${formatShortDateTime(session.scheduledStart)} · ${actual}/${Math.ceil(session.plannedDurationSeconds / 60)} min`;
      sessionItem.append(details);

      if (session.status === POMODORO_SESSION_STATUS.PENDING) {
        const sessionActions = document.createElement("div");
        sessionActions.className = "btn-row";
        const isCurrent = active?.id === session.id && active.taskId === task.id;
        if (session.endedAt) {
          sessionActions.append(
            createButton("btn btn--primary", "Confirmar completada", () => runAction(
              () => pomodoroSessions.confirm(task.id, session.id)
            )),
            createButton("btn btn--danger", "Marcar incumplida", async () => {
              const reason = await promptDialog({ title: "¿Por qué no se completó?", message: "Cuéntalo en pocas palabras (opcional). Te ayudará a ver qué te distrae.", placeholder: "Ej.: me interrumpieron", confirmText: "Registrar", danger: true, icon: "📝" });
              if (reason !== null) runAction(() => pomodoroSessions.markUnfulfilled(task.id, session.id, reason));
            })
          );
        } else {
          sessionActions.append(
            createButton("btn", isCurrent && pomodoroSessions.getState().timer?.running ? "Sesión en curso" : "Reanudar sesión", () => runAction(
              () => pomodoroSessions.resume(task.id, session.id)
            ), { disabled: Boolean(active && !isCurrent) }),
            createButton("btn btn--danger", "Marcar incumplida", async () => {
              const reason = await promptDialog({ title: "¿Por qué no se completó?", message: "Cuéntalo en pocas palabras (opcional). Te ayudará a ver qué te distrae.", placeholder: "Ej.: me interrumpieron", confirmText: "Registrar", danger: true, icon: "📝" });
              if (reason !== null) runAction(() => pomodoroSessions.markUnfulfilled(task.id, session.id, reason));
            }, { disabled: Boolean(active && !isCurrent) })
          );
        }
        sessionItem.append(sessionActions);
      } else if (session.failureReason) {
        const reason = document.createElement("small");
        reason.textContent = `Motivo: ${session.failureReason}`;
        sessionItem.append(reason);
      }

      sessionList.append(sessionItem);
    }
    if (sessionList.childElementCount) pomodoroSection.append(sessionList);

    item.append(title, description, progress, meta);
    if (blockHint) item.append(blockHint);
    return item;
  }

  function render(tasks) {
    list.replaceChildren(...[...tasks].sort(byStart).map(renderItem));
  }

  taskService.subscribe(render);
  pomodoroSessions.subscribe(() => render(taskService.getAll()));
  // Las categorías propias se cargan aparte: al llegar (o cambiar) se redibujan las etiquetas.
  extras.subscribeCategories?.(() => render(taskService.getAll()));
}
