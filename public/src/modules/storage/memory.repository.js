/**
 * REPOSITORIO EN MEMORIA (modo demo). Los datos se pierden al recargar.
 * Implementa la misma interfaz que firestore.repository.js:
 *   list()  create(data)  update(id, changes)  remove(id)   (todas async)
 */
export function createMemoryRepository(initialTasks = []) {
  let tasks = initialTasks.map((task) => ({ ...task }));

  return {
    async list() {
      return tasks.map((task) => ({ ...task }));
    },
    async create(data) {
      const task = { ...data, id: crypto.randomUUID() };
      tasks.push(task);
      return { ...task };
    },
    async update(id, changes) {
      const index = tasks.findIndex((task) => task.id === id);
      if (index < 0) throw new Error(`No existe la tarea ${id}`);
      tasks[index] = { ...tasks[index], ...changes, id };
      return { ...tasks[index] };
    },
    async remove(id) {
      tasks = tasks.filter((task) => task.id !== id);
    },
  };
}
