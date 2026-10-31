/**
 * Punto único de acceso al SDK de Firebase.
 * Carga el SDK desde CDN SOLO cuando se necesita y solo si existe src/config/firebase.config.js.
 * Así la app funciona en modo demo (sin Firebase) desde un clon limpio.
 *
 * IMPORTANTE: firebase.config.js NO está en Git; cada entorno lo crea en src/config/.
 * Si se mueve este archivo, hay que mantener la ruta relativa hacia src/config/.
 */
const FIREBASE_VERSION = "10.14.1"; // Si la cambias, actualiza también el README.
const CDN = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;

let cached = null;

/**
 * @typedef {Object} FirebaseHandles
 * @property {object} auth     Instancia de Auth
 * @property {object} db       Instancia de Firestore
 * @property {object} authApi  Módulo firebase-auth (signInWith…, onAuthStateChanged…)
 * @property {object} fsApi    Módulo firebase-firestore (collection, doc, getDocs…)
 *
 * @returns {Promise<FirebaseHandles>}
 * @throws {Error} si falta firebase.config.js.
 */
export async function getFirebase() {
  if (cached) return cached;

  let firebaseConfig;
  try {
    ({ firebaseConfig } = await import("../../config/firebase.config.js"));
  } catch {
    throw new Error(
      "Firebase no está configurado: copia src/config/firebase.config.example.js a firebase.config.js y completa tus datos."
    );
  }

  const [{ initializeApp }, authApi, fsApi] = await Promise.all([
    import(`${CDN}/firebase-app.js`),
    import(`${CDN}/firebase-auth.js`),
    import(`${CDN}/firebase-firestore.js`),
  ]);

  const app = initializeApp(firebaseConfig);
  cached = { auth: authApi.getAuth(app), db: fsApi.getFirestore(app), authApi, fsApi };
  return cached;
}
