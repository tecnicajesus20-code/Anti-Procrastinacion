/**
 * CONTRATO DE PERSISTENCIA DE TAREAS (puerto). Lo implementan:
 *   - infrastructure/memory/task.memory.repository.js   (modo demo)
 *   - infrastructure/firebase/task.firestore.repository.js (usuario autenticado)
 *
 * Todas las operaciones son asíncronas.
 *
 * @typedef {import("../domain/task.js").Task} Task
 * @typedef {import("../domain/task.js").TaskData} TaskData
 *
 * @typedef {Object} TaskRepository
 * @property {() => Promise<Task[]>} list
 *   Todas las tareas del propietario, sin orden garantizado.
 * @property {(data: TaskData) => Promise<Task>} create
 *   Guarda una tarea nueva; el repositorio asigna el id (un id en `data` se ignora).
 * @property {(id: string, changes: Partial<TaskData>) => Promise<Task>} update
 *   Aplica cambios parciales y devuelve la tarea completa guardada.
 *   Rechaza si el id no existe (memoria: Error; Firestore: code "not-found").
 * @property {(id: string) => Promise<void>} remove
 *   Elimina la tarea. Eliminar un id inexistente no es un error.
 *
 * Errores: los de Firestore se propagan con su `code` ("permission-denied", "unavailable"…).
 * Ningún repositorio valida reglas de negocio: eso lo hace task.service antes de llamar.
 */

const METHODS = ["list", "create", "update", "remove"];

/**
 * Falla pronto si un objeto no cumple el contrato (evita errores tardíos y confusos).
 * @param {unknown} repository
 * @returns {asserts repository is TaskRepository}
 */
export function assertTaskRepository(repository) {
  const missing = METHODS.filter((method) => typeof repository?.[method] !== "function");
  if (missing.length) throw new TypeError(`El repositorio de tareas no implementa: ${missing.join(", ")}`);
}
