/**
 * CATEGORÍAS PROPIAS EN CLOUD FIRESTORE. Implementa el contrato CategoryRepository
 * (ver application/category-repository.js).
 * Ruta de datos: users/{uid}/categories/{categoryId}. No toca el documento de perfil users/{uid}.
 * El aislamiento entre usuarios lo garantizan las reglas de firestore.rules.
 */
import { getFirebase as defaultGetFirebase } from "./firebase.client.js";

const USERS = "users";
const CATEGORIES = "categories";

/**
 * @param {string} uid
 * @param {{ getFirebase?: typeof defaultGetFirebase }} [deps]
 * @returns {import("../../application/category-repository.js").CategoryRepository}
 */
export function createFirestoreCategoryRepository(uid, { getFirebase = defaultGetFirebase } = {}) {
  if (!uid) throw new Error("Se requiere un UID para crear el repositorio de categorías.");

  async function context() {
    const { db, fsApi } = await getFirebase();
    return {
      fsApi,
      collection: fsApi.collection(db, USERS, uid, CATEGORIES),
      docRef: (id) => fsApi.doc(db, USERS, uid, CATEGORIES, id),
    };
  }

  return {
    async list() {
      const { fsApi, collection } = await context();
      const snapshot = await fsApi.getDocs(collection);
      return snapshot.docs.map((doc) => {
        const { name, color } = doc.data();
        return { id: doc.id, name, color };
      });
    },
    async create({ name, color }) {
      const { fsApi, collection } = await context();
      const now = new Date().toISOString();
      const ref = await fsApi.addDoc(collection, { name, color, userId: uid, createdAt: now, updatedAt: now });
      return { id: ref.id, name, color };
    },
    async remove(id) {
      const { fsApi, docRef } = await context();
      await fsApi.deleteDoc(docRef(id));
    },
  };
}
