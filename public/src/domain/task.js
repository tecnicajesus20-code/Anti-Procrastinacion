/**
 * DOMINIO DE TAREAS: contrato de datos, validación y reglas de estado.
 * Sin dependencias: no conoce el DOM, Firebase ni FullCalendar.
 *
 * CONTRATO DE DATOS DE UNA TAREA. Todos los módulos deben respetarlo.
 * Cada tarea tiene un bloque horario principal (start/end) y puede incluir bloques adicionales.
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
 * @property {{start: string, end: string}[]} [blocks] Bloques horarios de la tarea
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
  if (data.blocks !== undefined) {
    if (!Array.isArray(data.blocks) || data.blocks.length === 0) {
      errors.push("La tarea necesita al menos un bloque horario.");
    } else if (data.blocks.some((block, index) => {
      if (index === 0 && block?.start === data.start && block?.end === data.end) return false;
      const blockStart = Date.parse(block?.start);
      const blockEnd = Date.parse(block?.end);
      return Number.isNaN(blockStart) || Number.isNaN(blockEnd) || blockEnd <= blockStart;
    })) {
      errors.push("Cada bloque necesita una hora de fin posterior a la de inicio.");
    } else {
      const sortedBlocks = [...data.blocks].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
      if (sortedBlocks.some((block, index) => index > 0 && Date.parse(block.start) < Date.parse(sortedBlocks[index - 1].end))) {
        errors.push("Los bloques de una misma tarea no pueden repetir ni superponer horarios.");
      }
    }
  }
  if (data.dueDate && Number.isNaN(Date.parse(data.dueDate))) errors.push("La fecha límite no es válida.");
  return errors;
}

/**
 * Devuelve los bloques de una tarea, incluyendo compatibilidad con tareas antiguas sin `blocks`.
 * @param {{start: string, end: string, blocks?: {start: string, end: string}[]}} task
 */
export function getTaskBlocks(task) {
  return Array.isArray(task.blocks) && task.blocks.length ? task.blocks.map((block) => ({ ...block })) : [{ start: task.start, end: task.end }];
}

/** @param {Task} task */
export function cloneTask(task) {
  return {
    ...task,
    ...(Array.isArray(task.blocks) ? { blocks: task.blocks.map((block) => ({ ...block })) } : {}),
  };
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
    blocks: [{ start: input.start, end: input.end }],
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
