import { cloneTask } from "../../domain/task.js";

/**
 * REPOSITORIO DE TAREAS EN MEMORIA (modo demo). Los datos se pierden al recargar.
 * Implementa el contrato TaskRepository (ver application/task-repository.js).
 * Errores: update() lanza Error("No existe la tarea <id>") si el id no existe.
 *
 * @param {import("../../domain/task.js").Task[]} [initialTasks]
 * @returns {import("../../application/task-repository.js").TaskRepository}
 */
export function createMemoryTaskRepository(initialTasks = []) {
  let tasks = initialTasks.map(cloneTask);

  return {
    async list() {
      return tasks.map(cloneTask);
    },
    async create(data) {
      const task = cloneTask({ ...data, id: crypto.randomUUID() });
      tasks.push(task);
      return cloneTask(task);
    },
    async update(id, changes) {
      const index = tasks.findIndex((task) => task.id === id);
      if (index < 0) throw new Error(`No existe la tarea ${id}`);
      tasks[index] = cloneTask({ ...tasks[index], ...changes, id });
      return cloneTask(tasks[index]);
    },
    async remove(id) {
      tasks = tasks.filter((task) => task.id !== id);
    },
  };
}
