// Firestore falso con las reglas de firestore.rules portadas a JS.
import { fake, sleep } from "./state.js";
const err = (code, msg) => Object.assign(new Error(msg ?? code), { code });
export const getFirestore = () => ({});
export const collection = (_db, ...s) => ({ type: "col", path: s.join("/"), segs: s });
export const doc = (_db, ...s) => ({ type: "doc", path: s.join("/"), segs: s, id: s.at(-1) });

function isOwner(uid) { return fake.current && fake.current.uid === uid; }
function isValidTask(t) {
  const k = Object.keys(t);
  return ["title", "status", "start", "end"].every((x) => k.includes(x))
    && k.every((x) => ["title", "description", "status", "dueDate", "start", "end"].includes(x))
    && typeof t.title === "string" && t.title.length > 0 && t.title.length <= 120
    && ["pending", "in_progress", "done"].includes(t.status)
    && typeof t.start === "string" && typeof t.end === "string" && t.end > t.start;
}
async function gate(op, segs) {
  const uid = segs[1];
  const allowed = isOwner(uid); // el token viaja con la petición: se evalúa al enviarla, no al responder
  const d = fake.delays[`${op}:${uid}`] ?? fake.delays[op] ?? 1;
  await sleep(d);
  if (fake.failNext && fake.failNext.op === op) { const f = fake.failNext; fake.failNext = null; throw err(f.code, f.message); }
  if (segs[0] !== "users" || segs[2] !== "tasks" || !allowed) throw err("permission-denied", "Missing or insufficient permissions.");
}
export async function getDocs(col) {
  await gate("list", col.segs);
  const prefix = col.path + "/";
  return { docs: [...fake.docs].filter(([p]) => p.startsWith(prefix) && !p.slice(prefix.length).includes("/"))
    .map(([p, data]) => ({ id: p.slice(prefix.length), data: () => structuredClone(data) })) };
}
export async function addDoc(col, data) {
  await gate("create", col.segs);
  if (!isValidTask(data)) throw err("permission-denied", "Missing or insufficient permissions.");
  const id = `fs-${fake.nextId++}`;
  fake.docs.set(`${col.path}/${id}`, structuredClone(data));
  return { id };
}
export async function updateDoc(ref, changes) {
  await gate("update", ref.segs);
  const cur = fake.docs.get(ref.path);
  if (!cur) throw err("not-found", `No document to update: ${ref.path}`);
  const next = { ...cur, ...changes };
  if (!isValidTask(next)) throw err("permission-denied", "Missing or insufficient permissions.");
  fake.docs.set(ref.path, next);
}
export async function getDoc(ref) {
  await gate("get", ref.segs);
  const d = fake.docs.get(ref.path);
  return { exists: () => !!d, data: () => (d ? structuredClone(d) : undefined) };
}
export async function deleteDoc(ref) { await gate("delete", ref.segs); fake.docs.delete(ref.path); }
