import { cloneTask, validateTask } from "../../domain/task.js";

/**
 * REPOSITORIO DE TAREAS EN MEMORIA (modo demo), opcionalmente persistido en Web Storage.
 * Implementa el contrato TaskRepository (ver application/task-repository.js).
 * Errores: update() lanza Error("No existe la tarea <id>") si el id no existe.
 *
 * @param {import("../../domain/task.js").Task[]} [initialTasks]
 * @param {{ storage?: Storage, storageKey?: string }} [options]
 * @returns {import("../../application/task-repository.js").TaskRepository}
 */
export function createMemoryTaskRepository(initialTasks = [], { storage = null, storageKey = null } = {}) {
  if ((storage && !storageKey) || (!storage && storageKey)) {
    throw new TypeError("storage y storageKey deben proporcionarse juntos.");
  }

  let tasks = initialTasks.map(cloneTask);

  function persist(nextTasks) {
    if (storage) storage.setItem(storageKey, JSON.stringify(nextTasks));
    tasks = nextTasks;
  }

  return {
    async list() {
      if (storage) {
        const saved = storage.getItem(storageKey);
        if (saved !== null) {
          let parsed;
          try {
            parsed = JSON.parse(saved);
          } catch (error) {
            throw new Error("No se pudieron leer las tareas guardadas del modo demo.", { cause: error });
          }
          if (!Array.isArray(parsed) || parsed.some((task) => (
            !task || typeof task.id !== "string" || validateTask(task).length > 0
          ))) {
            throw new Error("Las tareas guardadas del modo demo no tienen un formato válido.");
          }
          tasks = parsed.map(cloneTask);
        }
      }
      return tasks.map(cloneTask);
    },
    async create(data) {
      const task = cloneTask({ ...data, id: crypto.randomUUID() });
      persist([...tasks, task]);
      return cloneTask(task);
    },
    async update(id, changes) {
      const index = tasks.findIndex((task) => task.id === id);
      if (index < 0) throw new Error(`No existe la tarea ${id}`);
      const task = cloneTask({ ...tasks[index], ...changes, id });
      persist(tasks.map((current, currentIndex) => (currentIndex === index ? task : current)));
      return cloneTask(task);
    },
    async remove(id) {
      persist(tasks.filter((task) => task.id !== id));
    },
  };
}
