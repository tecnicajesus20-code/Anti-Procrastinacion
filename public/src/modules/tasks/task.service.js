/**
 * SERVICIO DE TAREAS: única fuente de verdad en memoria.
 * No toca el DOM ni conoce FullCalendar o Firebase: recibe un "repositorio" (ver storage/).
 *
 * API pública:
 *   load()                      Carga las tareas desde el repositorio
 *   useRepository(repo)         Cambia de repositorio y recarga (ej. al iniciar sesión)
 *   getAll()                    Copia de la lista actual
 *   add(input)                  Crea una tarea (valida el contrato)
 *   update(id, changes)         Modifica campos de una tarea
 *   remove(id)                  Elimina una tarea
 *   moveBlock(id, start, end)   Mueve el bloque horario de una tarea
 *   subscribe(callback)         Avisa en cada cambio; devuelve función para cancelar
 */
import { validateTask, buildTaskData } from "./task.model.js";

/** @param {object} initialRepository Objeto con list/create/update/remove */
export function createTaskService(initialRepository) {
  let repository = initialRepository;
  let tasks = [];
  const listeners = new Set();

  function notify() {
    const snapshot = tasks.map((task) => ({ ...task }));
    listeners.forEach((callback) => callback(snapshot));
  }

  function assertValid(data) {
    const errors = validateTask(data);
    if (errors.length) throw new Error(errors.join(" "));
  }

  async function load() {
    tasks = await repository.list();
    notify();
  }

  async function useRepository(newRepository) {
    repository = newRepository;
    await load();
  }

  async function add(input) {
    const data = buildTaskData(input);
    assertValid(data);
    const created = await repository.create(data);
    tasks.push(created);
    notify();
    return created;
  }

  async function update(id, changes) {
    const current = tasks.find((task) => task.id === id);
    if (!current) throw new Error(`No existe la tarea ${id}`);
    assertValid({ ...current, ...changes });
    const saved = await repository.update(id, changes);
    tasks = tasks.map((task) => (task.id === id ? saved : task));
    notify();
    return saved;
  }

  async function remove(id) {
    await repository.remove(id);
    tasks = tasks.filter((task) => task.id !== id);
    notify();
  }

  const moveBlock = (id, start, end) => update(id, { start, end });

  function subscribe(callback) {
    listeners.add(callback);
    return () => listeners.delete(callback);
  }

  return { load, useRepository, getAll: () => tasks.map((task) => ({ ...task })), add, update, remove, moveBlock, subscribe };
}
