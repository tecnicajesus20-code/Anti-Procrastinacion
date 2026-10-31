/**
 * Punto único de acceso a Firebase.
 * Carga el SDK desde CDN SOLO cuando se necesita y solo si existe firebase.config.js.
 * Así la app funciona en modo demo (sin Firebase) desde un clon limpio.
 */
const FIREBASE_VERSION = "10.14.1"; // Si la cambias, actualiza también el README.
const CDN = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;

let cached = null;

/**
 * @returns {Promise<{auth: object, db: object, authApi: object, fsApi: object}>}
 *   auth/db son las instancias; authApi/fsApi son los módulos del SDK (signInWith..., collection...).
 * @throws {Error} si falta firebase.config.js.
 */
export async function getFirebase() {
  if (cached) return cached;

  let firebaseConfig;
  try {
    ({ firebaseConfig } = await import("./firebase.config.js"));
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
