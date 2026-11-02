import { getFirebase } from './firebase.client.js';
import { TaskFirestoreMapper } from './task.firestore.mapper.js';

export function createFirestoreTaskRepository(uid) {
  if (!uid) throw new Error("Se requiere un UID para crear el repositorio de Firestore.");

  return {
    async list() {
      const { db, fsApi } = await getFirebase();
      const tasksRef = fsApi.collection(db, 'users', uid, 'tasks');
      const snapshot = await fsApi.getDocs(tasksRef);
      return snapshot.docs.map(doc => TaskFirestoreMapper.toDomain(doc.id, doc.data()));
    },

    async create(data) {
      // Regla de persistencia: Se exige el bloque horario
      if (!data.start || !data.end) {
        throw new Error("RECHAZADO: No se puede guardar una tarea sin programación (start/end).");
      }

      const { db, fsApi } = await getFirebase();
      const firestoreData = TaskFirestoreMapper.toFirestore({ ...data, userId: uid });
      
      const collectionRef = fsApi.collection(db, 'users', uid, 'tasks');
      const docRef = await fsApi.addDoc(collectionRef, firestoreData);
      
      return TaskFirestoreMapper.toDomain(docRef.id, firestoreData);
    },

    async update(id, changes) {
      // Si se intentan modificar las fechas, no pueden quedar vacías
      if (('start' in changes && !changes.start) || ('end' in changes && !changes.end)) {
        throw new Error("RECHAZADO: No puedes dejar la tarea sin fechas de inicio o fin.");
      }

      const { db, fsApi } = await getFirebase();
      const docRef = fsApi.doc(db, 'users', uid, 'tasks', id);
      
      const updateData = { ...changes, updatedAt: new Date().toISOString() };
      await fsApi.updateDoc(docRef, updateData);

      const updatedSnap = await fsApi.getDoc(docRef);
      return TaskFirestoreMapper.toDomain(updatedSnap.id, updatedSnap.data());
    },

    async remove(id) {
      const { db, fsApi } = await getFirebase();
      const docRef = fsApi.doc(db, 'users', uid, 'tasks', id);
      await fsApi.deleteDoc(docRef);
      return id;
    }
  };
}