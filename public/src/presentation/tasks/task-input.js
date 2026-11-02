/**
 * Lectura de formularios de tareas. Lo comparten el formulario de la lista y el diálogo
 * del calendario para que ambos entreguen al caso de uso exactamente el mismo formato.
 */
import { byId } from "../../shared/dom.js";
import { localInputToIso } from "../../shared/date-time.js";

const DATE_FIELDS = new Set(["start", "end", "dueDate"]);

/**
 * @param {Record<string, string>} fieldIds  campo de la tarea → id del input (ej. { title: "task-title" })
 * @returns {Record<string, string|null>} textos tal cual; fechas convertidas a ISO 8601 (o null si vacías)
 */
export function readTaskInput(fieldIds) {
  return Object.fromEntries(
    Object.entries(fieldIds).map(([field, id]) => {
      const value = byId(id).value;
      return [field, DATE_FIELDS.has(field) ? localInputToIso(value) : value];
    })
  );
}
