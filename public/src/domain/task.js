/**
 * DOMINIO DE TAREAS: contrato de datos, validación y reglas de estado.
 * Sin dependencias: no conoce el DOM, Firebase ni FullCalendar.
 *
 * CONTRATO DE DATOS DE UNA TAREA. Todos los módulos deben respetarlo.
 * Cada tarea tiene un único bloque horario (start/end) obligatorio.
 * Las fechas se guardan como texto ISO 8601 (ej. "2026-11-02T09:00:00.000Z").
 *
 * @typedef {Object} Task
 * @property {string} id                 Identificador único
 * @property {string} title              Obligatorio
 * @property {string|null} description   Opcional
 * @property {"pending"|"in_progress"|"done"} status
 * @property {string|null} dueDate       Fecha límite opcional (ISO 8601)
 * @property {string} start              Inicio del bloque (ISO 8601), obligatorio
 * @property {string} end                Fin del bloque (ISO 8601), obligatorio y posterior a start
 *
 * @typedef {Omit<Task, "id">} TaskData  Tarea sin id (antes de guardarla)
 */

export const TASK_STATUS = Object.freeze({
  PENDING: "pending",
  IN_PROGRESS: "in_progress",
  DONE: "done",
});

/**
 * Valida los datos de una tarea (sin comprobar el id).
 * @param {Partial<Task>} data
 * @returns {string[]} Lista de errores; vacía si todo está bien.
 */
export function validateTask(data) {
  const errors = [];
  if (typeof data.title !== "string" || !data.title.trim()) errors.push("El título es obligatorio.");
  if (!Object.values(TASK_STATUS).includes(data.status)) errors.push("El estado no es válido.");

  const start = Date.parse(data.start);
  const end = Date.parse(data.end);
  if (Number.isNaN(start) || Number.isNaN(end)) {
    errors.push("La tarea necesita un bloque horario (inicio y fin).");
  } else if (end <= start) {
    errors.push("La hora de fin debe ser posterior a la de inicio.");
  }
  if (data.dueDate && Number.isNaN(Date.parse(data.dueDate))) errors.push("La fecha límite no es válida.");
  return errors;
}

/**
 * Normaliza lo que llega de un formulario al formato del contrato (sin id).
 * @param {Object} input
 * @returns {TaskData}
 */
export function buildTaskData(input) {
  const description = typeof input.description === "string" ? input.description.trim() : "";
  return {
    title: typeof input.title === "string" ? input.title.trim() : "",
    description: description || null,
    status: input.status ?? TASK_STATUS.PENDING,
    dueDate: input.dueDate || null,
    start: input.start,
    end: input.end,
  };
}

/**
 * Regla de "Completar / Reabrir": una tarea terminada vuelve a pendiente;
 * cualquier otra (pendiente o en curso) pasa a terminada.
 * @param {Task["status"]} status
 * @returns {Task["status"]}
 */
export function toggledStatus(status) {
  return status === TASK_STATUS.DONE ? TASK_STATUS.PENDING : TASK_STATUS.DONE;
}

/** @param {Task} task */
export const isDone = (task) => task.status === TASK_STATUS.DONE;

/** Orden de presentación: por inicio del bloque (ISO 8601 ordena como texto). */
export const byStart = (a, b) => a.start.localeCompare(b.start);
