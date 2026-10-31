/**
 * Contrato TaskRepository: memoria y Firestore deben comportarse igual.
 * Firestore se prueba con un SDK falso inyectado (fsApi) que registra las rutas usadas.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createMemoryTaskRepository } from "../../public/src/infrastructure/memory/task.memory.repository.js";
import { createFirestoreTaskRepository } from "../../public/src/infrastructure/firebase/task.firestore.repository.js";
import { taskFromDocument, taskToDocument } from "../../public/src/infrastructure/firebase/task.firestore.mapper.js";

function fakeFirebase() {
  const docs = new Map(); const calls = []; let n = 0;
  const fsApi = {
    collection: (_db, ...s) => ({ path: s.join("/") }),
    doc: (_db, ...s) => ({ path: s.join("/") }),
    getDocs: async (c) => ({ docs: [...docs].filter(([p]) => p.startsWith(c.path + "/")).map(([p, d]) => ({ id: p.split("/").pop(), data: () => ({ ...d }) })) }),
    addDoc: async (c, d) => { calls.push(["addDoc", c.path, d]); const id = `d${++n}`; docs.set(`${c.path}/${id}`, { ...d }); return { id }; },
    updateDoc: async (r, ch) => { calls.push(["updateDoc", r.path, ch]); if (!docs.has(r.path)) throw Object.assign(new Error("nf"), { code: "not-found" }); docs.set(r.path, { ...docs.get(r.path), ...ch }); },
    getDoc: async (r) => ({ data: () => ({ ...docs.get(r.path) }) }),
    deleteDoc: async (r) => { calls.push(["deleteDoc", r.path]); docs.delete(r.path); },
  };
  return { docs, calls, getFirebase: async () => ({ db: {}, fsApi }) };
}

const data = { title: "T", description: null, status: "pending", dueDate: null, start: "2026-11-02T09:00:00.000Z", end: "2026-11-02T10:00:00.000Z" };

for (const [name, make] of [
  ["memoria", () => createMemoryTaskRepository()],
  ["firestore", () => createFirestoreTaskRepository("u1", { getFirebase: fakeFirebase().getFirebase })],
]) {
  test(`contrato TaskRepository (${name})`, async () => {
    const repo = make();
    assert.deepEqual(await repo.list(), []);
    const created = await repo.create({ ...data, id: "ignorado" });
    assert.equal(typeof created.id, "string");
    assert.notEqual(created.id, "ignorado");
    assert.deepEqual({ ...created, id: undefined }, { ...data, id: undefined });
    const updated = await repo.update(created.id, { status: "done" });
    assert.deepEqual(updated, { ...data, id: created.id, status: "done" });
    assert.deepEqual(await repo.list(), [updated]);
    await assert.rejects(repo.update("no-existe", { status: "done" }));
    await repo.remove(created.id);
    assert.deepEqual(await repo.list(), []);
    await repo.remove("no-existe"); // eliminar algo inexistente no falla (igual que Firestore)
  });
}

test("firestore: rutas y esquema exactos (users/{uid}/tasks/{id}, sin campo id)", async () => {
  const fb = fakeFirebase();
  const repo = createFirestoreTaskRepository("abc", { getFirebase: fb.getFirebase });
  const c = await repo.create({ ...data, id: "x" });
  await repo.update(c.id, { start: data.start, end: "2026-11-02T11:00:00.000Z" });
  await repo.remove(c.id);
  assert.deepEqual(fb.calls, [
    ["addDoc", "users/abc/tasks", data],
    ["updateDoc", `users/abc/tasks/${c.id}`, { start: data.start, end: "2026-11-02T11:00:00.000Z" }],
    ["deleteDoc", `users/abc/tasks/${c.id}`],
  ]);
});

test("memoria: devuelve copias (el llamador no puede mutar el estado interno)", async () => {
  const repo = createMemoryTaskRepository([{ ...data, id: "a" }]);
  (await repo.list())[0].title = "mutado";
  assert.equal((await repo.list())[0].title, "T");
});

test("mapper", () => {
  assert.deepEqual(taskFromDocument("i", { title: "x" }), { id: "i", title: "x" });
  assert.deepEqual(taskToDocument({ id: "i", title: "x" }), { title: "x" });
});
