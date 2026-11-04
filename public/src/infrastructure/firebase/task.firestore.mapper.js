export class TaskFirestoreMapper {
  static toDomain(id, data) {
    return cloneTask({ 
      id: id,
      title: data.title || '',
      description: data.description || null,
      status: data.status || 'pending',
      dueDate: data.dueDate || null,
      start: data.start, // Obligatorio según tu dominio
      end: data.end      // Obligatorio según tu dominio
    });
  }

  static toFirestore(task) {
    return {
      title: task.title,
      description: task.description || null,
      status: task.status || 'pending',
      dueDate: task.dueDate || null,
      start: task.start,
      end: task.end,
      ...(Array.isArray(task.blocks) ? { blocks: task.blocks } : {}), 
      userId: task.userId,
      createdAt: task.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }
}
import { cloneTask } from "../../domain/task.js";

/**
 * Conversión entre documentos de Firestore y el modelo Task.
 * El esquema es 1:1 (mismos nombres y tipos; fechas como texto ISO 8601).
 * El id NO se guarda como campo: es el id del documento (las reglas rechazan un campo "id").
 */

import { cloneTask } from "../../domain/task.js";

/** @returns {import("../../domain/task.js").Task} */
export const taskFromDocument = (id, data) => cloneTask({ id, ...data });

/** Quita el id (si viene) para escribir solo campos del documento. */
export function taskToDocument(task) {
  const { id: _ignored, ...data } = cloneTask(task);
  return data;
}
