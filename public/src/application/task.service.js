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
 *   moveBlock(id, start, end, blockIndex) Mueve o redimensiona un bloque horario (conserva sus demás campos)
 *   updateBlock(id, blockIndex, changes, blockChanges?) Edita la tarea y uno de sus bloques
 *   addBlock(id, start, end, blockFields?) Añade un bloque a una tarea existente
 *   removeBlock(id, blockIndex) Elimina un bloque sin dejar la tarea sin horario
 *   remove(id)                  Elimina una tarea
 *   subscribe(callback)         Avisa con una copia de la lista en cada cambio; devuelve función para cancelar
 *
 * Aislamiento entre sesiones: si el repositorio cambia mientras una operación está en curso
 * (p. ej. se cierra sesión), su resultado NO se mezcla con el estado de la nueva sesión.
 */
import { validateTask, buildTaskData, cloneTask, getTaskBlocks, toggledStatus } from "../domain/task.js";
import { validateTaskExtensions } from "../domain/task-extensions.js";
import { assertTaskRepository } from "./task-repository.js";

/** @param {import("./task-repository.js").TaskRepository} initialRepository */
export function createTaskService(initialRepository) {
  assertTaskRepository(initialRepository);
  let repository = initialRepository;
  let tasks = [];
  let loadTicket = 0;
  const listeners = new Set();

  const copy = () => tasks.map(cloneTask);

  function notify() {
    const snapshot = copy();
    listeners.forEach((callback) => callback(snapshot));
  }

  function assertValid(data) {
    const errors = [...validateTask(data), ...validateTaskExtensions(data)];
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

  /**
   * @param {Object} changes       Campos de la tarea + start/end del bloque
   * @param {Object} [blockChanges] Campos propios del bloque (difficulty, focusIntent…). Opcional.
   * Los campos que ya tenía el bloque (dificultad, resultado…) se conservan al moverlo o editarlo.
   */
  async function updateBlock(id, blockIndex, changes, blockChanges = {}) {
    const task = findOrThrow(id);
    const blocks = getTaskBlocks(task);
    if (!Number.isInteger(blockIndex) || blockIndex < 0 || blockIndex >= blocks.length) {
      throw new Error("El bloque horario seleccionado no existe.");
    }
    if (blocks[blockIndex].outcome && "difficulty" in blockChanges && blockChanges.difficulty !== blocks[blockIndex].difficulty) {
      throw new Error("No se puede cambiar la dificultad de un bloque que ya tiene resultado.");
    }

    blocks[blockIndex] = { ...blocks[blockIndex], ...blockChanges, start: changes.start, end: changes.end };
    const updated = {
      ...changes,
      blocks,
      start: blocks[0].start,
      end: blocks[0].end,
    };
    assertValid({ ...task, ...updated });
    return write(
      (target) => target.update(id, updated),
      (saved) => { tasks = tasks.map((candidate) => (candidate.id === id ? saved : candidate)); }
    );
  }

  const moveBlock = (id, start, end, blockIndex = 0) => {
    const task = findOrThrow(id);
    const blocks = getTaskBlocks(task);
    if (!Number.isInteger(blockIndex) || blockIndex < 0 || blockIndex >= blocks.length) {
      throw new Error("El bloque horario seleccionado no existe.");
    }
    return updateBlock(id, blockIndex, { start, end });
  };

  /** @param {Object} [blockFields] Campos opcionales del bloque nuevo (p. ej. { difficulty }) */
  async function addBlock(id, start, end, blockFields = {}) {
    const task = findOrThrow(id);
    const blocks = getTaskBlocks(task);
    blocks.push({ ...blockFields, start, end });
    const updated = { blocks };
    assertValid({ ...task, ...updated });
    return write(
      (target) => target.update(id, updated),
      (saved) => { tasks = tasks.map((candidate) => (candidate.id === id ? saved : candidate)); }
    );
  }

  async function removeBlock(id, blockIndex) {
    const task = findOrThrow(id);
    const blocks = getTaskBlocks(task);
    if (!Number.isInteger(blockIndex) || blockIndex < 0 || blockIndex >= blocks.length) {
      throw new Error("El bloque horario seleccionado no existe.");
    }
    if (blocks.length === 1) {
      throw new Error("No puedes eliminar el único bloque. Agrega otro bloque o elimina la tarea.");
    }

    blocks.splice(blockIndex, 1);
    const updated = {
      blocks,
      start: blocks[0].start,
      end: blocks[0].end,
    };
    assertValid({ ...task, ...updated });
    return write(
      (target) => target.update(id, updated),
      (saved) => { tasks = tasks.map((candidate) => (candidate.id === id ? saved : candidate)); }
    );
  }

  async function remove(id) {
    return write((target) => target.remove(id), () => { tasks = tasks.filter((task) => task.id !== id); });
  }

  function subscribe(callback) {
    listeners.add(callback);
    return () => listeners.delete(callback);
  }

  return { load, useRepository, getAll: copy, add, update, updateBlock, addBlock, removeBlock, toggleDone, moveBlock, remove, subscribe };
}
