/**
 * CATEGORÍAS PROPIAS EN MEMORIA (modo demo), opcionalmente persistidas en Web Storage.
 * Implementa el contrato CategoryRepository (ver application/category-repository.js).
 *
 * @param {{id: string, name: string, color: string}[]} [initial]
 * @param {{ storage?: Storage, storageKey?: string }} [options]
 */
export function createMemoryCategoryRepository(initial = [], { storage = null, storageKey = null } = {}) {
  if ((storage && !storageKey) || (!storage && storageKey)) {
    throw new TypeError("storage y storageKey deben proporcionarse juntos.");
  }
  let categories = initial.map((category) => ({ ...category }));

  function persist(next) {
    if (storage) storage.setItem(storageKey, JSON.stringify(next));
    categories = next;
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
            throw new Error("No se pudieron leer las categorías guardadas del modo demo.", { cause: error });
          }
          if (!Array.isArray(parsed) || parsed.some((c) => !c || typeof c.id !== "string" || typeof c.name !== "string")) {
            throw new Error("Las categorías guardadas del modo demo no tienen un formato válido.");
          }
          categories = parsed.map((category) => ({ ...category }));
        }
      }
      return categories.map((category) => ({ ...category }));
    },
    async create(data) {
      const category = { id: crypto.randomUUID(), name: data.name, color: data.color };
      persist([...categories, category]);
      return { ...category };
    },
    async remove(id) {
      persist(categories.filter((category) => category.id !== id));
    },
  };
}
