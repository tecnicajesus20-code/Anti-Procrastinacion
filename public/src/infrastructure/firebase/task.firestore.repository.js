/**
 * REPOSITORIO DE TAREAS EN CLOUD FIRESTORE. Implementa el contrato TaskRepository
 * (ver application/task-repository.js).
 * Ruta de datos: users/{uid}/tasks/{taskId}. El aislamiento entre usuarios lo garantizan
 * las reglas de firestore.rules, no este código.
 * Errores: se propagan los de Firebase (con `code`, ej. "permission-denied", "not-found", "unavailable").
 */
import { getFirebase as defaultGetFirebase } from "./firebase.client.js";
import { TaskFirestoreMapper } from "./task.firestore.mapper.js";

const USERS = "users";
const TASKS = "tasks";

/**
 * @param {string} uid Identificador del usuario autenticado
 * @param {{ getFirebase?: typeof defaultGetFirebase }} [deps]
 * @returns {import("../../application/task-repository.js").TaskRepository}
 */
export function createFirestoreTaskRepository(uid, { getFirebase = defaultGetFirebase } = {}) {
  if (!uid) throw new Error("Se requiere un UID para crear el repositorio de Firestore.");

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
      return snapshot.docs.map((doc) => TaskFirestoreMapper.toDomain(doc.id, doc.data()));
    },
    async create(taskData) {
      if (!taskData.start || !taskData.end) {
        throw new Error("RECHAZADO: No se puede guardar una tarea sin programación (start/end).");
      }

      const { fsApi, collection } = await context();
      const firestoreData = TaskFirestoreMapper.toFirestore({ ...taskData, userId: uid });
      const ref = await fsApi.addDoc(collection, firestoreData);
      return TaskFirestoreMapper.toDomain(ref.id, firestoreData);
    },
    async update(id, changes) {
      if (("start" in changes && !changes.start) || ("end" in changes && !changes.end)) {
        throw new Error("RECHAZADO: No puedes dejar la tarea sin fechas de inicio o fin.");
      }

      const { fsApi, docRef } = await context();
      const updateData = {
        ...changes,
        ...(Array.isArray(changes.pomodoroSessions)
          ? { pomodoroSessions: changes.pomodoroSessions.map((session) => ({ ...session, ownerUid: uid })) }
          : {}),
        updatedAt: new Date().toISOString(),
      };
      await fsApi.updateDoc(docRef(id), updateData);
      const snapshot = await fsApi.getDoc(docRef(id));
      return TaskFirestoreMapper.toDomain(snapshot.id, snapshot.data());
    },
    async remove(id) {
      const { fsApi, docRef } = await context();
      await fsApi.deleteDoc(docRef(id));
      return id;
    },
  };
}
