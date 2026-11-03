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
    getDoc: async (r) => ({ id: r.path.split("/").pop(), data: () => ({ ...docs.get(r.path) }) }),
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
  assert.deepEqual(fb.calls.map(([method, path]) => [method, path]), [
    ["addDoc", "users/abc/tasks"],
    ["updateDoc", `users/abc/tasks/${c.id}`],
    ["deleteDoc", `users/abc/tasks/${c.id}`],
  ]);
  const firestoreTask = fb.calls[0][2];
  assert.deepEqual(
    Object.fromEntries(Object.entries(firestoreTask).filter(([key]) => !["userId", "createdAt", "updatedAt"].includes(key))),
    data
  );
  assert.equal(firestoreTask.userId, "abc");
  assert.ok(Number.isFinite(Date.parse(firestoreTask.createdAt)));
  const updateData = fb.calls[1][2];
  assert.deepEqual({ start: updateData.start, end: updateData.end }, {
    start: data.start,
    end: "2026-11-02T11:00:00.000Z",
  });
  assert.ok(Number.isFinite(Date.parse(updateData.updatedAt)));
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

test("firestore: conserva los bloques adicionales sin compartir referencias", async () => {
  const fb = fakeFirebase();
  const repo = createFirestoreTaskRepository("u1", { getFirebase: fb.getFirebase });
  const blocks = [
    { start: data.start, end: data.end },
    { start: "2026-11-03T09:00:00.000Z", end: "2026-11-03T10:00:00.000Z" },
  ];
  const created = await repo.create({ ...data, blocks });
  blocks[1].start = "mutado";

  const [loaded] = await repo.list();
  assert.equal(loaded.blocks[1].start, "2026-11-03T09:00:00.000Z");
  const updatedBlocks = [...loaded.blocks, { start: "2026-11-04T09:00:00.000Z", end: "2026-11-04T10:00:00.000Z" }];
  const saved = await repo.update(created.id, { blocks: updatedBlocks });
  assert.equal(saved.blocks.length, 3);
});

test("firestore: persiste trazabilidad Pomodoro y asocia el UID propietario", async () => {
  const fb = fakeFirebase();
  const repo = createFirestoreTaskRepository("usuario-7", { getFirebase: fb.getFirebase });
  const task = await repo.create(data);
  const session = {
    id: "session-1",
    taskId: task.id,
    ownerUid: null,
    blockIndex: 0,
    sessionIndex: 0,
    scheduleKey: "0:2026-11-02T09:00:00.000Z",
    scheduledStart: "2026-11-02T09:00:00.000Z",
    scheduledEnd: "2026-11-02T09:25:00.000Z",
    plannedDurationSeconds: 1500,
    actualDurationSeconds: 1500,
    startedAt: "2026-11-02T09:00:00.000Z",
    endedAt: "2026-11-02T09:25:00.000Z",
    runningSince: null,
    status: "pending",
    failureReason: null,
  };

  await repo.update(task.id, {
    pomodoroSessions: [session],
    pomodoroStatus: "pending",
    pomodoroCompletionRate: 0,
  });
  const [loaded] = await repo.list();
  assert.equal(loaded.pomodoroSessions[0].ownerUid, "usuario-7");
  assert.equal(loaded.pomodoroSessions[0].taskId, task.id);
  assert.equal(loaded.pomodoroSessions[0].status, "pending");
  assert.equal(loaded.pomodoroStatus, "pending");
  assert.equal(loaded.pomodoroCompletionRate, 0);
});
