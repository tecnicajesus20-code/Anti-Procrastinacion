/**
 * CONTRATO DE PERSISTENCIA DE CATEGORÍAS PROPIAS (puerto). Lo implementan:
 *   - infrastructure/memory/category.memory.repository.js     (modo demo)
 *   - infrastructure/firebase/category.firestore.repository.js (usuario autenticado)
 * Las 5 categorías base NO se guardan: viven en domain/category.js.
 *
 * @typedef {{id: string, name: string, color: string}} StoredCategory
 * @typedef {Object} CategoryRepository
 * @property {() => Promise<StoredCategory[]>} list
 * @property {(data: {name: string, color: string}) => Promise<StoredCategory>} create  El repositorio asigna el id
 * @property {(id: string) => Promise<void>} remove   Eliminar un id inexistente no es un error
 */

const METHODS = ["list", "create", "remove"];

/** @returns {asserts repository is CategoryRepository} */
export function assertCategoryRepository(repository) {
  const missing = METHODS.filter((method) => typeof repository?.[method] !== "function");
  if (missing.length) throw new TypeError(`El repositorio de categorías no implementa: ${missing.join(", ")}`);
}
