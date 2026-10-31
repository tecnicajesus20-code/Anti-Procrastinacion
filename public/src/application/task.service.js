/**
 * CASOS DE USO DE TAREAS y única fuente de verdad en memoria.
 * No toca el DOM ni conoce FullCalendar o Firebase: trabaja con un TaskRepository.
 * La lista y el calendario usan los MISMOS casos de uso (ej. add) para crear tareas.
 *
 * API pública:
 *   load()                      Recarga las tareas del repositorio activo
 *   useRepository(repo)         Cambia de repositorio y recarga (ej. al iniciar/cerrar sesión)
 *   getAll()                    Copia de la lista actual
 *   add(input)                  Crea una tarea (normaliza y valida con el dominio)
 *   update(id, changes)         Modifica campos de una tarea
 *   toggleDone(id)              Completar / reabrir
 *   moveBlock(id, start, end)   Mueve o redimensiona el bloque horario
 *   remove(id)                  Elimina una tarea
 *   subscribe(callback)         Avisa con una copia de la lista en cada cambio; devuelve función para cancelar
 *
 * Aislamiento entre sesiones: si el repositorio cambia mientras una operación está en curso
 * (p. ej. se cierra sesión), su resultado NO se mezcla con el estado de la nueva sesión.
 */
import { validateTask, buildTaskData, toggledStatus } from "../domain/task.js";
import { assertTaskRepository } from "./task-repository.js";

/** @param {import("./task-repository.js").TaskRepository} initialRepository */
export function createTaskService(initialRepository) {
  assertTaskRepository(initialRepository);
  let repository = initialRepository;
  let tasks = [];
  let loadTicket = 0;
  const listeners = new Set();

  const copy = () => tasks.map((task) => ({ ...task }));

  function notify() {
    const snapshot = copy();
    listeners.forEach((callback) => callback(snapshot));
  }

  function assertValid(data) {
    const errors = validateTask(data);
    if (errors.length) throw new Error(errors.join(" "));
  }

  function findOrThrow(id) {
    const task = tasks.find((candidate) => candidate.id === id);
    if (!task) throw new Error(`No existe la tarea ${id}`);
    return task;
  }

  /**
   * Ejecuta una escritura contra el repositorio activo y aplica el resultado al estado
   * solo si ese repositorio sigue activo al terminar.
   */
  async function write(operation, applyResult) {
    const target = repository;
    const result = await operation(target);
    if (target === repository) {
      applyResult(result);
      notify();
    }
    return result;
  }

  /**
   * @returns {Promise<boolean>} false si la carga quedó obsoleta (otra carga empezó después)
   * @throws el error del repositorio, solo si la carga sigue siendo la vigente
   */
  async function loadFrom(target) {
    const ticket = ++loadTicket;
    try {
      const loaded = await target.list();
      if (ticket !== loadTicket) return false;
      tasks = loaded;
      notify();
      return true;
    } catch (error) {
      if (ticket !== loadTicket) return false;
      throw error;
    }
  }

  const load = () => loadFrom(repository);

  async function useRepository(newRepository) {
    assertTaskRepository(newRepository);
    repository = newRepository;
    return loadFrom(newRepository);
  }

  async function add(input) {
    const data = buildTaskData(input);
    assertValid(data);
    return write((target) => target.create(data), (created) => tasks.push(created));
  }

  async function update(id, changes) {
    assertValid({ ...findOrThrow(id), ...changes });
    return write(
      (target) => target.update(id, changes),
      (saved) => { tasks = tasks.map((task) => (task.id === id ? saved : task)); }
    );
  }

  const toggleDone = async (id) => update(id, { status: toggledStatus(findOrThrow(id).status) });

  const moveBlock = (id, start, end) => update(id, { start, end });

  async function remove(id) {
    return write((target) => target.remove(id), () => { tasks = tasks.filter((task) => task.id !== id); });
  }

  function subscribe(callback) {
    listeners.add(callback);
    return () => listeners.delete(callback);
  }

  return { load, useRepository, getAll: copy, add, update, toggleDone, moveBlock, remove, subscribe };
}
