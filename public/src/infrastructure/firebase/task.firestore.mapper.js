import { cloneTask } from "../../domain/task.js";

/**
 * Convierte entre documentos Firestore y el modelo Task sin perder bloques ni trazabilidad Pomodoro.
 * El id del documento no se guarda dentro del documento.
 */
export class TaskFirestoreMapper {
  static toDomain(id, data) {
    const { createdAt: _createdAt, updatedAt: _updatedAt, userId: _userId, ...taskData } = data;
    return cloneTask({ id, ...taskData });
  }

  static toFirestore(task) {
    const { id: _ignored, ...data } = cloneTask(task);
    return {
      ...data,
      createdAt: task.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
}

/** @returns {import("../../domain/task.js").Task} */
export const taskFromDocument = (id, data) => cloneTask({ id, ...data });

/** Quita el id (si viene) para escribir solo campos del documento. */
export function taskToDocument(task) {
  const { id: _ignored, ...data } = cloneTask(task);
  return data;
}