/**
 * SERVICIO DE AUTENTICACIÓN (Firebase Authentication, correo y contraseña).
 * Sin DOM. Si Firebase no está configurado, cada función lanza un error claro
 * (ver config/firebase.js): NO se simula una sesión.
 *
 * API pública: register, login, logout, resetPassword, onAuthChange
 * Usuario devuelto: { uid, email } o null.
 */
import { getFirebase } from "../../config/firebase.js";

const toUser = (user) => (user ? { uid: user.uid, email: user.email } : null);

export const authService = {
  async register(email, password) {
    const { auth, authApi } = await getFirebase();
    return toUser((await authApi.createUserWithEmailAndPassword(auth, email, password)).user);
  },

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

  /** Avisa al iniciar/cerrar sesión. Devuelve (en una promesa) la función para cancelar. */
  async onAuthChange(callback) {
    const { auth, authApi } = await getFirebase();
    return authApi.onAuthStateChanged(auth, (user) => callback(toUser(user)));
  },
};
