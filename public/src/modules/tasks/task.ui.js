/**
 * PRESENTACIÓN DE TAREAS: formulario de alta y lista.
 * Lee el DOM y delega toda la lógica en taskService.
 */
import { byId } from "../../ui/dom.js";
import { showMessage, clearMessage } from "../../ui/feedback.js";
import { TASK_STATUS } from "./task.model.js";

/** Convierte el valor de un <input datetime-local> a ISO 8601 (o null si está vacío). */
function toIso(value) {
  return value ? new Date(value).toISOString() : null;
}

/** Convierte una fecha al formato local que espera un input datetime-local. */
function toLocalInputValue(date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

/** Ejecuta una acción y muestra el error si falla. */
async function run(action) {
  try {
    await action();
    clearMessage();
  } catch (error) {
    showMessage(error.message, "error");
  }
}

/** @param {ReturnType<import("./task.service.js").createTaskService>} taskService */
export function initTaskUi(taskService) {
  const form = byId("task-form");
  const list = byId("task-list");
  const eventDialog = byId("event-dialog");
  const eventForm = byId("event-form");

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    run(async () => {
      await taskService.add({
        title: byId("task-title").value,
        description: byId("task-description").value,
        dueDate: toIso(byId("task-due").value),
        start: toIso(byId("task-start").value),
        end: toIso(byId("task-end").value),
      });
      form.reset();
    });
  });

  function openCalendarTask({ start, end }) {
    byId("event-title").value = "";
    byId("event-description").value = "";
    byId("event-start").value = toLocalInputValue(start);
    byId("event-end").value = toLocalInputValue(end);
    eventDialog.showModal();
    byId("event-title").focus();
  }

  eventForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await taskService.add({
        title: byId("event-title").value,
        description: byId("event-description").value,
        start: toIso(byId("event-start").value),
        end: toIso(byId("event-end").value),
      });
      eventDialog.close();
      eventForm.reset();
      clearMessage();
    } catch (error) {
      showMessage(error.message, "error");
    }
  });

  byId("event-dialog-close").addEventListener("click", () => eventDialog.close());
  byId("event-dialog-cancel").addEventListener("click", () => eventDialog.close());

  function render(tasks) {
    list.replaceChildren();
    const sorted = [...tasks].sort((a, b) => a.start.localeCompare(b.start));
    for (const task of sorted) {
      const isDone = task.status === TASK_STATUS.DONE;
      const item = document.createElement("li");
      item.className = isDone ? "task-item task-item--done" : "task-item";

      const title = document.createElement("span");
      title.className = "task-title";
      title.textContent = task.title; // textContent evita inyectar HTML

      const time = document.createElement("span");
      time.className = "task-time";
      const format = { dateStyle: "short", timeStyle: "short" };
      time.textContent = `${new Date(task.start).toLocaleString("es", format)} → ${new Date(task.end).toLocaleString("es", format)}`;

      const actions = document.createElement("div");
      actions.className = "btn-row";

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "btn";
      toggle.textContent = isDone ? "Reabrir" : "Completar";
      toggle.addEventListener("click", () =>
        run(() => taskService.update(task.id, { status: isDone ? TASK_STATUS.PENDING : TASK_STATUS.DONE }))
      );

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "btn btn--danger";
      remove.textContent = "Eliminar";
      remove.addEventListener("click", () => run(() => taskService.remove(task.id)));

      actions.append(toggle, remove);
      item.append(title, time, actions);
      list.append(item);
    }
  }

  taskService.subscribe(render);
  return { openCalendarTask };
}
