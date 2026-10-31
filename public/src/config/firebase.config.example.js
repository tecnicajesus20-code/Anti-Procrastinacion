/**
 * PLANTILLA de configuración de Firebase.
 * Cópiala como src/config/firebase.config.js (ese archivo NO se sube a Git).
 * La app la carga con import() dinámico desde infrastructure/firebase/firebase.client.js
 * y espera exactamente esta exportación con nombre: `firebaseConfig`.
 * No añadas imports aquí: el SDK se carga desde CDN en firebase.client.js.
 *
 * Valores del proyecto muven-antiprocrastinacion (la configuración web de Firebase no es secreta;
 * la seguridad la dan las reglas de Firestore).
 */
export const firebaseConfig = {
  apiKey: "AIzaSyC74-uNF6k5NyRYxr3koihs_F63nRmrz8g",
  authDomain: "muven-antiprocrastinacion.firebaseapp.com",
  projectId: "muven-antiprocrastinacion",
  storageBucket: "muven-antiprocrastinacion.firebasestorage.app",
  messagingSenderId: "128814084808",
  appId: "1:128814084808:web:ac7236f8efddd8c32b6bfd",
  measurementId: "G-CKJYYJ051N",
};
