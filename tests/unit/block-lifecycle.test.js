/**
 * Categorías (servicio y repositorio demo), resultado del bloque, puntos sin duplicados,
 * intención al iniciar y vigilancia del fin del bloque (3 min → campanita, 24 h → no realizado).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createTaskService } from "../../public/src/application/task.service.js";
import { createCategoryService } from "../../public/src/application/category.service.js";
import { createBlockOutcomeService } from "../../public/src/application/block-outcome.service.js";
import { createBlockEndWatcher } from "../../public/src/application/block-end-watcher.service.js";
import { createMemoryTaskRepository } from "../../public/src/infrastructure/memory/task.memory.repository.js";
import { createMemoryCategoryRepository } from "../../public/src/infrastructure/memory/category.memory.repository.js";
import { pointsSummary } from "../../public/src/domain/stats.js";

const MIN = 60_000;
const T0 = Date.parse("2026-11-02T09:00:00.000Z");
const iso = (ms) => new Date(ms).toISOString();
const task = (id, blocks, extra = {}) => ({
  id, title: id, description: null, status: "pending", dueDate: null,
  start: blocks[0].start, end: blocks[0].end, blocks, ...extra,
});
const blk = (fromMin, minutes, difficulty) => ({ start: iso(T0 + fromMin * MIN), end: iso(T0 + (fromMin + minutes) * MIN), ...(difficulty ? { difficulty } : {}) });

function storage() {
  const data = new Map();
  return { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), removeItem: (k) => data.delete(k) };
}

async function setup(tasks, nowMs) {
  const taskService = createTaskService(createMemoryTaskRepository(tasks));
  await taskService.load();
  const clock = { value: nowMs };
  const outcomes = createBlockOutcomeService({ taskService, now: () => new Date(clock.value) });
  return { taskService, outcomes, clock };
}

test("categorías: crear propia, no eliminar base, eliminar propia reasigna sus tareas a Ocio", async () => {
  const taskService = createTaskService(createMemoryTaskRepository([
    task("a", [blk(0, 30)], { category: "c1" }), task("b", [blk(0, 30)], { category: "trabajo" }),
  ]));
  await taskService.load();
  const repo = createMemoryCategoryRepository([{ id: "c1", name: "Gimnasio", color: "#112233" }]);
  const categories = createCategoryService(repo, { taskService });
  await categories.load();
  assert.deepEqual(categories.getAll().map((c) => c.name), ["Hogar", "Trabajo", "Estudio", "Entretenimiento", "Ocio", "Gimnasio"]);

  await assert.rejects(categories.add({ name: "gimnasio" }), /Ya existe/);
  const created = await categories.add({ name: "Lectura", color: "#abcdef" });
  assert.equal(categories.getAll().at(-1).id, created.id);

  await assert.rejects(categories.remove("ocio"), /base no se pueden eliminar/);
  await assert.rejects(categories.remove("trabajo"), /base no se pueden eliminar/);
  assert.equal(categories.countTasks("c1"), 1);
  assert.equal(await categories.remove("c1"), 1);
  assert.equal(taskService.getAll().find((t) => t.id === "a").category, "ocio");
  assert.equal(taskService.getAll().find((t) => t.id === "b").category, "trabajo");
  assert.ok(!categories.getAll().some((c) => c.id === "c1"));
  assert.deepEqual((await repo.list()).map((c) => c.name), ["Lectura"]);
});

test("categorías: si falla la reasignación, la categoría NO se borra", async () => {
  const base = createMemoryTaskRepository([task("a", [blk(0, 30)], { category: "c1" })]);
  const failing = { ...base, update: async () => { throw Object.assign(new Error("sin red"), { code: "unavailable" }); } };
  const taskService = createTaskService(failing);
  await taskService.load();
  const repo = createMemoryCategoryRepository([{ id: "c1", name: "Gimnasio", color: "#112233" }]);
  const categories = createCategoryService(repo, { taskService });
  await categories.load();
  await assert.rejects(categories.remove("c1"), /sin red/);
  assert.equal((await repo.list()).length, 1);
});

test("categorías demo persisten en Web Storage", async () => {
  const store = storage();
  const make = () => createMemoryCategoryRepository([], { storage: store, storageKey: "cats" });
  const taskService = createTaskService(createMemoryTaskRepository([]));
  const first = createCategoryService(make(), { taskService });
  await first.load();
  await first.add({ name: "Música" });
  const second = createCategoryService(make(), { taskService });
  await second.load();
  assert.ok(second.getAll().some((c) => c.name === "Música"));
});

test("Completar por bloque: puntos por bloque, una sola vez, y la tarea se completa al final", async () => {
  const { taskService, outcomes, clock } = await setup([task("t", [blk(0, 60, "intermedia"), blk(120, 30, "facil")])], T0 + 30 * MIN);
  await outcomes.complete("t", 0);
  let saved = taskService.getAll()[0];
  assert.equal(saved.blocks[0].outcome.points, 12);
  assert.equal(saved.status, "pending"); // falta el segundo bloque

  await assert.rejects(outcomes.complete("t", 0), /ya tiene un resultado/); // repetir no suma
  await assert.rejects(outcomes.complete("t", 1), /todavía no ha empezado/);

  clock.value = T0 + 125 * MIN;
  await outcomes.complete("t", { start: saved.blocks[1].start, end: saved.blocks[1].end });
  saved = taskService.getAll()[0];
  assert.equal(saved.status, "done");
  assert.deepEqual(pointsSummary([saved]), { earned: 14, lost: 0, net: 14, completedBlocks: 2, failedBlocks: 0 });
});

test("dos clics simultáneos en el mismo bloque solo registran un resultado", async () => {
  const { taskService, outcomes } = await setup([task("t", [blk(0, 30, "facil")])], T0 + 10 * MIN);
  const results = await Promise.allSettled([outcomes.complete("t", 0), outcomes.complete("t", 0)]);
  assert.deepEqual(results.map((r) => r.status).sort(), ["fulfilled", "rejected"]);
  assert.equal(pointsSummary(taskService.getAll()).earned, 2);
});

test("recargar (otro servicio sobre el mismo almacenamiento) no permite puntuar de nuevo", async () => {
  const store = storage();
  const repo = () => createMemoryTaskRepository([task("t", [blk(0, 30, "facil")])], { storage: store, storageKey: "k" });
  const first = createTaskService(repo());
  await first.load();
  await createBlockOutcomeService({ taskService: first, now: () => new Date(T0 + 10 * MIN) }).complete("t", 0);
  const reloaded = createTaskService(repo());
  await reloaded.load();
  await assert.rejects(createBlockOutcomeService({ taskService: reloaded, now: () => new Date(T0 + 11 * MIN) }).complete("t", 0), /ya tiene un resultado/);
  assert.equal(pointsSummary(reloaded.getAll()).earned, 2);
});

test("respuesta No: Desvío del 20 % y la tarea no se completa; no se puede responder No antes del fin", async () => {
  const { taskService, outcomes, clock } = await setup([task("t", [blk(0, 60, "intermedia")])], T0 + 30 * MIN);
  await assert.rejects(outcomes.answer("t", 0, false), /todavía no ha terminado/);
  clock.value = T0 + 61 * MIN;
  await outcomes.answer("t", 0, false);
  const saved = taskService.getAll()[0];
  assert.deepEqual([saved.blocks[0].outcome.status, saved.blocks[0].outcome.points, saved.status], ["not_completed", -2, "pending"]); // 20 % de 12
});

test("tarea antigua (sin dificultad): Completar no suma ni resta, pero cuenta para completar la tarea", async () => {
  const { taskService, outcomes } = await setup([task("t", [blk(0, 90)])], T0 + 10 * MIN);
  await outcomes.complete("t", 0);
  const saved = taskService.getAll()[0];
  assert.equal(saved.blocks[0].outcome.points, 0);
  assert.equal(saved.status, "done");
});

test("intención del bloque: se guarda en el bloque, no puede estar vacía y no cambia el horario", async () => {
  const { taskService, outcomes } = await setup([task("t", [blk(0, 30, "facil"), blk(60, 30)])], T0);
  await outcomes.defineIntent("t", 1, "  Terminar la introducción  ");
  const saved = taskService.getAll()[0];
  assert.equal(saved.blocks[1].focusIntent, "Terminar la introducción");
  assert.equal(saved.blocks[1].start, blk(60, 30).start);
  assert.equal(saved.blocks[0].focusIntent, undefined);
  await assert.rejects(outcomes.defineIntent("t", 0, "   "), /no puede estar vacía/);
});

function watcherSetup(tasks, nowMs) {
  return setup(tasks, nowMs).then(({ taskService, outcomes, clock }) => {
    const prompts = [];
    const pendings = [];
    const errors = [];
    const watcher = createBlockEndWatcher({
      taskService,
      blockOutcomes: outcomes,
      onPrompt: (p) => prompts.push(p),
      onPendingChange: (list) => pendings.push(list.map((p) => p.key)),
      onError: (e) => errors.push(e),
      clock: { now: () => clock.value, setInterval: () => 1, clearInterval: () => {} },
    });
    return { taskService, outcomes, clock, watcher, prompts, pendings, errors };
  });
}

test("fin del bloque: aviso una sola vez dentro de 3 min; después queda en la campanita sin puntos", async () => {
  const s = await watcherSetup([task("t", [blk(0, 30, "facil")]), task("old", [blk(0, 30)])], T0 + 20 * MIN);
  s.watcher.start();
  assert.equal(s.prompts.length, 0);
  assert.deepEqual(s.pendings.at(-1), []);

  s.clock.value = T0 + 31 * MIN; // terminó hace 1 min
  s.watcher.check();
  s.watcher.check(); // el mismo evento otra vez: no repite el aviso
  assert.equal(s.prompts.length, 1);
  assert.equal(s.prompts[0].closesAt, T0 + 33 * MIN);
  assert.equal(s.pendings.at(-1).length, 1); // la tarea antigua nunca aparece

  s.clock.value = T0 + 40 * MIN; // pasaron los 3 minutos sin respuesta
  s.watcher.check();
  assert.equal(s.pendings.at(-1).length, 1);
  assert.equal(s.taskService.getAll()[0].blocks[0].outcome, undefined); // sin penalización todavía

  await s.outcomes.answer("t", 0, true); // responde desde la campanita
  assert.deepEqual(s.pendings.at(-1), []);
  assert.equal(s.taskService.getAll()[0].blocks[0].outcome.points, 2);
});

test("abrir la app más de 3 min después del fin: no hay aviso, solo campanita", async () => {
  const s = await watcherSetup([task("t", [blk(0, 30, "facil")])], T0 + 50 * MIN);
  s.watcher.start();
  assert.equal(s.prompts.length, 0);
  assert.equal(s.pendings.at(-1).length, 1);
});

test("24 h sin respuesta: se registra como no realizado una sola vez", async () => {
  const s = await watcherSetup([task("t", [blk(0, 60, "intermedia")])], T0 + 60 * MIN + 24 * 60 * MIN);
  s.watcher.start();
  s.watcher.check();
  await new Promise((resolve) => setTimeout(resolve, 0));
  const outcome = s.taskService.getAll()[0].blocks[0].outcome;
  assert.deepEqual([outcome.status, outcome.points, outcome.source], ["not_completed", -2, "timeout"]); // 20 % de 12
  s.watcher.check();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(pointsSummary(s.taskService.getAll()).lost, 2); // una sola vez, aunque se compruebe dos veces
  assert.deepEqual(s.errors, []);
});

test("Firestore (falso con las reglas): categorías en users/{uid}/categories, aisladas por usuario; tareas con category", async () => {
  const fsApi = await import("./regression/fakes/firebase-firestore.js");
  const { fake } = await import("./regression/fakes/state.js");
  const { createFirestoreCategoryRepository } = await import("../../public/src/infrastructure/firebase/category.firestore.repository.js");
  const { createFirestoreTaskRepository } = await import("../../public/src/infrastructure/firebase/task.firestore.repository.js");
  const getFirebase = async () => ({ db: {}, fsApi });
  fake.docs.clear();
  fake.current = { uid: "ana" };
  const anaCats = createFirestoreCategoryRepository("ana", { getFirebase });
  const created = await anaCats.create({ name: "Gimnasio", color: "#112233" });
  assert.deepEqual(await anaCats.list(), [{ id: created.id, name: "Gimnasio", color: "#112233" }]);
  assert.ok([...fake.docs.keys()].includes(`users/ana/categories/${created.id}`));
  await assert.rejects(anaCats.create({ name: "", color: "#112233" }), /permission/i); // la regla rechaza nombre vacío

  const anaTasks = createFirestoreTaskRepository("ana", { getFirebase });
  const task = await anaTasks.create({ title: "T", description: null, status: "pending", dueDate: null, start: blk(0, 30).start, end: blk(0, 30).end, blocks: [blk(0, 30, "facil")], category: created.id });
  const updated = await anaTasks.update(task.id, { blocks: [{ ...blk(0, 30, "facil"), outcome: { status: "completed", points: 2, resolvedAt: iso(T0), source: "user" } }] });
  assert.equal(updated.category, created.id);
  assert.equal(updated.blocks[0].outcome.points, 2);

  fake.current = { uid: "beto" };
  await assert.rejects(createFirestoreCategoryRepository("ana", { getFirebase }).list(), /permission/i);
  assert.deepEqual(await createFirestoreCategoryRepository("beto", { getFirebase }).list(), []);
  fake.current = { uid: "ana" };
  await anaCats.remove(created.id);
  assert.deepEqual(await anaCats.list(), []);
  fake.current = null;
  fake.docs.clear();
});
