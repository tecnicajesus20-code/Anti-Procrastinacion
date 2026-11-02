/**
 * ADAPTADOR DE FIREBASE AUTHENTICATION (correo y contraseña).
 * Sin DOM. Si Firebase no está configurado, cada función lanza un error claro
 * (ver firebase.client.js): NO se simula una sesión.
 *
 * Usuario devuelto: { uid, email } o null. Los errores de Firebase conservan su `code` (ej. "auth/invalid-credential").
 *
 * @typedef {{ uid: string, email: string }} SessionUser
 */
import { getFirebase as defaultGetFirebase } from "./firebase.client.js";

const toUser = (user) => (user ? { uid: user.uid, email: user.email } : null);

/** @param {{ getFirebase?: typeof defaultGetFirebase }} [deps] */
export function createFirebaseAuth({ getFirebase = defaultGetFirebase } = {}) {
  return {
    /** @returns {Promise<SessionUser>} */
    async register(email, password) {
      const { auth, authApi } = await getFirebase();
      return toUser((await authApi.createUserWithEmailAndPassword(auth, email, password)).user);
    },

    /** @returns {Promise<SessionUser>} */
    async login(email, password) {
      const { auth, authApi } = await getFirebase();
      return toUser((await authApi.signInWithEmailAndPassword(auth, email, password)).user);
    },

    async logout() {
      const { auth, authApi } = await getFirebase();
      await authApi.signOut(auth);
    },

    async resetPassword(email) {
      const { auth, authApi } = await getFirebase();
      await authApi.sendPasswordResetEmail(auth, email);
    },

    /**
     * Avisa al iniciar/cerrar sesión (y una vez al suscribirse, con el estado actual).
     * @param {(user: SessionUser|null) => void} callback
     * @returns {Promise<() => void>} función para cancelar la suscripción
     * @throws {Error} si Firebase no está configurado
     */
    async onAuthChange(callback) {
      const { auth, authApi } = await getFirebase();
      return authApi.onAuthStateChanged(auth, (user) => callback(toUser(user)));
    },
  };
}
