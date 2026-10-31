/**
 * REPOSITORIO CON CLOUD FIRESTORE. Misma interfaz que memory.repository.js.
 * Ruta de datos: users/{uid}/tasks/{taskId}. El aislamiento entre usuarios lo garantizan
 * las reglas de firestore.rules, no este código.
 */
import { getFirebase } from "../../config/firebase.js";

/** @param {string} uid Identificador del usuario autenticado */
export function createFirestoreRepository(uid) {
  async function context() {
    const { db, fsApi } = await getFirebase();
    return {
      fsApi,
      collection: fsApi.collection(db, "users", uid, "tasks"),
      docRef: (id) => fsApi.doc(db, "users", uid, "tasks", id),
    };
  }

  return {
    async list() {
      const { fsApi, collection } = await context();
      const snapshot = await fsApi.getDocs(collection);
      return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    },
    async create(taskData) {
      const { id: _ignored, ...data } = taskData; // el id lo asigna Firestore
      const { fsApi, collection } = await context();
      const ref = await fsApi.addDoc(collection, data);
      return { id: ref.id, ...data };
    },
    async update(id, changes) {
      const { fsApi, docRef } = await context();
      await fsApi.updateDoc(docRef(id), changes);
      const snapshot = await fsApi.getDoc(docRef(id));
      return { id, ...snapshot.data() };
    },
    async remove(id) {
      const { fsApi, docRef } = await context();
      await fsApi.deleteDoc(docRef(id));
    },
  };
}
