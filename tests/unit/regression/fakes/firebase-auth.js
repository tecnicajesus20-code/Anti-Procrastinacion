import { fake, sleep } from "./state.js";
const err = (code) => Object.assign(new Error(`Firebase: Error (${code}).`), { code });
const user = () => (fake.current ? { uid: fake.current.uid, email: fake.current.email } : null);
const emit = () => fake.listeners.forEach((cb) => cb(user()));
export const getAuth = () => ({});
export function onAuthStateChanged(_auth, cb) {
  fake.listeners.add(cb);
  setTimeout(() => cb(user()), 0); // Firebase siempre emite el estado inicial de forma asíncrona
  return () => fake.listeners.delete(cb);
}
export async function createUserWithEmailAndPassword(_a, email, password) {
  await sleep(1);
  if (!email) throw err("auth/invalid-email");
  if (fake.users.has(email)) throw err("auth/email-already-in-use");
  if (!password || password.length < 6) throw err("auth/weak-password");
  fake.users.set(email, { uid: `uid-${email.split("@")[0]}`, email, password });
  fake.current = fake.users.get(email); emit();
  return { user: user() };
}
export async function signInWithEmailAndPassword(_a, email, password) {
  await sleep(1);
  const u = fake.users.get(email);
  if (!u || u.password !== password) throw err("auth/invalid-credential");
  fake.current = u; emit();
  return { user: user() };
}
export async function signOut() { await sleep(1); fake.current = null; emit(); }
export async function sendPasswordResetEmail(_a, email) { await sleep(1); if (!email) throw err("auth/missing-email"); fake.resetSentTo = email; }
