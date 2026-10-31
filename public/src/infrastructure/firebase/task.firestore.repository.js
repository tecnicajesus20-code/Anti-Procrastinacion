/**
 * REPOSITORIO DE TAREAS EN CLOUD FIRESTORE. Implementa el contrato TaskRepository
 * (ver application/task-repository.js).
 * Ruta de datos: users/{uid}/tasks/{taskId}. El aislamiento entre usuarios lo garantizan
 * las reglas de firestore.rules, no este código.
 * Errores: se propagan los de Firebase (con `code`, ej. "permission-denied", "not-found", "unavailable").
 */
import { getFirebase as defaultGetFirebase } from "./firebase.client.js";
import { taskFromDocument, taskToDocument } from "./task.firestore.mapper.js";

const USERS = "users";
const TASKS = "tasks";

/**
 * @param {string} uid Identificador del usuario autenticado
 * @param {{ getFirebase?: typeof defaultGetFirebase }} [deps]
 * @returns {import("../../application/task-repository.js").TaskRepository}
 */
export function createFirestoreTaskRepository(uid, { getFirebase = defaultGetFirebase } = {}) {
  async function context() {
    const { db, fsApi } = await getFirebase();
    return {
      fsApi,
      collection: fsApi.collection(db, USERS, uid, TASKS),
      docRef: (id) => fsApi.doc(db, USERS, uid, TASKS, id),
    };
  }

  return {
    async list() {
      const { fsApi, collection } = await context();
      const snapshot = await fsApi.getDocs(collection);
      return snapshot.docs.map((doc) => taskFromDocument(doc.id, doc.data()));
    },
    async create(taskData) {
      const data = taskToDocument(taskData); // el id lo asigna Firestore
      const { fsApi, collection } = await context();
      const ref = await fsApi.addDoc(collection, data);
      return taskFromDocument(ref.id, data);
    },
    async update(id, changes) {
      const { fsApi, docRef } = await context();
      await fsApi.updateDoc(docRef(id), taskToDocument(changes));
      const snapshot = await fsApi.getDoc(docRef(id));
      return taskFromDocument(id, snapshot.data());
    },
    async remove(id) {
      const { fsApi, docRef } = await context();
      await fsApi.deleteDoc(docRef(id));
    },
  };
}
