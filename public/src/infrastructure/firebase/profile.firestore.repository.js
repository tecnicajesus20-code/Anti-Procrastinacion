import { getFirebase } from './firebase.client.js';

export function createFirestoreProfileRepository(uid) {
  if (!uid) throw new Error("Se requiere un UID para crear el repositorio de perfil.");
  const refOf = ({ db, fsApi }) => fsApi.doc(db, 'users', uid);

  return {
    async get() {
      const firebase = await getFirebase();
      const snapshot = await firebase.fsApi.getDoc(refOf(firebase));
      return snapshot.exists() ? snapshot.data() : null;
    },

    async save(data) {
      const firebase = await getFirebase();
      const ref = refOf(firebase);
      const existing = await firebase.fsApi.getDoc(ref);
      const now = new Date().toISOString();
      const document = {
        displayName: data.displayName,
        photo: data.photo ?? null,
        createdAt: existing.data()?.createdAt ?? now,
        updatedAt: now,
      };
      await firebase.fsApi.setDoc(ref, document);
      return document;
    },
  };
}