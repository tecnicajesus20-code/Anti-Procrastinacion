/**
 * Conversión entre documentos de Firestore y el modelo Task.
 * El esquema es 1:1 (mismos nombres y tipos; fechas como texto ISO 8601).
 * El id NO se guarda como campo: es el id del documento (las reglas rechazan un campo "id").
 */

/** @returns {import("../../domain/task.js").Task} */
export const taskFromDocument = (id, data) => ({ id, ...data });

/** Quita el id (si viene) para escribir solo campos del documento. */
export function taskToDocument(task) {
  const { id: _ignored, ...data } = task;
  return data;
}
