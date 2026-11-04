/**
 * CASOS DE USO DE CATEGORÍAS. No toca el DOM ni conoce Firebase: trabaja con un CategoryRepository.
 *
 * API pública:
 *   load() / useRepository(repo)   Carga las categorías propias del repositorio activo
 *   getAll()                       Base + propias (ver domain/category.js mergeCategories)
 *   add({ name, color })           Crea una categoría propia
 *   remove(id)                     Elimina una propia; sus tareas pasan a Ocio ANTES de borrarla
 *   subscribe(callback)            Avisa con la lista visible en cada cambio
 *
 * Igual que task.service: si el repositorio cambia (inicio/cierre de sesión) mientras una
 * operación está en curso, su resultado no se mezcla con la nueva sesión.
 */
import {
  mergeCategories, validateCategory, buildCategoryData, isBaseCategory, FALLBACK_CATEGORY_ID,
} from "../domain/category.js";
import { assertCategoryRepository } from "./category-repository.js";

/**
 * @param {import("./category-repository.js").CategoryRepository} initialRepository
 * @param {{ taskService: ReturnType<import("./task.service.js").createTaskService> }} deps
 */
export function createCategoryService(initialRepository, { taskService }) {
  assertCategoryRepository(initialRepository);
  if (!taskService) throw new TypeError("Se requiere taskService para reasignar tareas.");
  let repository = initialRepository;
  let custom = [];
  let loadTicket = 0;
  const listeners = new Set();

  const getAll = () => mergeCategories(custom);
  const notify = () => {
    const snapshot = getAll();
    listeners.forEach((callback) => callback(snapshot));
  };

  async function loadFrom(target) {
    const ticket = ++loadTicket;
    try {
      const loaded = await target.list();
      if (ticket !== loadTicket) return false;
      custom = loaded;
      notify();
      return true;
    } catch (error) {
      if (ticket !== loadTicket) return false;
      throw error;
    }
  }

  async function useRepository(next) {
    assertCategoryRepository(next);
    repository = next;
    custom = [];
    notify();
    return loadFrom(next);
  }

  async function add(input) {
    const data = buildCategoryData(input);
    const errors = validateCategory(data, getAll());
    if (errors.length) throw new Error(errors.join(" "));
    const target = repository;
    const created = await target.create(data);
    if (target === repository) {
      custom = [...custom, created];
      notify();
    }
    return created;
  }

  async function remove(id) {
    if (isBaseCategory(id)) throw new Error("Las categorías base no se pueden eliminar.");
    if (!custom.some((category) => category.id === id)) throw new Error("La categoría no existe.");
    const target = repository;
    // Primero se reasignan las tareas: si algo falla a mitad, la categoría sigue existiendo
    // y no quedan tareas apuntando a una categoría borrada.
    const affected = taskService.getAll().filter((task) => task.category === id);
    for (const task of affected) {
      await taskService.update(task.id, { category: FALLBACK_CATEGORY_ID });
    }
    await target.remove(id);
    if (target === repository) {
      custom = custom.filter((category) => category.id !== id);
      notify();
    }
    return affected.length;
  }

  /** Cuántas tareas usan la categoría (para el aviso antes de eliminar). */
  const countTasks = (id) => taskService.getAll().filter((task) => task.category === id).length;

  function subscribe(callback) {
    listeners.add(callback);
    return () => listeners.delete(callback);
  }

  return { load: () => loadFrom(repository), useRepository, getAll, add, remove, countTasks, subscribe };
}
