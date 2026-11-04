/**
 * Extensiones ADITIVAS del contrato de tareas (categoría y campos por bloque).
 * Comprueban sobre todo la compatibilidad: las tareas antiguas siguen igual.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTaskData, validateTask, cloneTask } from "../../public/src/domain/task.js";
import { validateTaskExtensions } from "../../public/src/domain/task-extensions.js";

const allErrors = (t) => [...validateTask(t), ...validateTaskExtensions(t)];
import { createTaskService } from "../../public/src/application/task.service.js";
import { createMemoryTaskRepository } from "../../public/src/infrastructure/memory/task.memory.repository.js";

const S = "2026-11-02T09:00:00.000Z";
const E30 = "2026-11-02T09:30:00.000Z";
const E60 = "2026-11-02T10:00:00.000Z";
const legacy = (id) => ({ id, title: id, description: null, status: "pending", dueDate: null, start: S, end: E60 });
const outcome = { status: "completed", points: 2, resolvedAt: "2026-11-02T09:31:00.000Z", source: "user" };

/** Memoria con Web Storage simulado para probar la recarga. */
function storage() {
  const data = new Map();
  return { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), removeItem: (k) => data.delete(k) };
}

test("buildTaskData sin categoría ni dificultad produce exactamente el formato anterior", () => {
  assert.deepEqual(buildTaskData({ title: " A ", start: S, end: E60 }), {
    title: "A", description: null, status: "pending", dueDate: null, start: S, end: E60, blocks: [{ start: S, end: E60 }],
  });
  assert.deepEqual(buildTaskData({ title: "A", start: S, end: E30, category: "estudio", difficulty: "facil" }).blocks, [{ start: S, end: E30, difficulty: "facil" }]);
  assert.equal(buildTaskData({ title: "A", start: S, end: E30, category: "estudio" }).category, "estudio");
});

test("validateTask + validateTaskExtensions: tareas antiguas válidas; campos nuevos validados solo si existen", () => {
  assert.deepEqual(allErrors(legacy("a")), []);
  assert.deepEqual(allErrors({ ...legacy("a"), category: "trabajo", blocks: [{ start: S, end: E30, difficulty: "facil", focusIntent: "Leer", outcome }] }), []);
  assert.deepEqual(allErrors({ ...legacy("a"), blocks: [{ start: S, end: E60, difficulty: "facil" }] }), ["La dificultad Fácil permite bloques de hasta 30 minutos."]);
  assert.deepEqual(allErrors({ ...legacy("a"), category: "" }), ["La categoría de la tarea no es válida."]);
  assert.deepEqual(allErrors({ ...legacy("a"), blocks: [{ start: S, end: E60, outcome: { status: "x" } }] }), ["El resultado del bloque no es válido."]);
});

test("cloneTask copia el resultado del bloque (no comparte el objeto)", () => {
  const task = { ...legacy("a"), blocks: [{ start: S, end: E30, outcome }] };
  const copy = cloneTask(task);
  copy.blocks[0].outcome.points = 99;
  assert.equal(task.blocks[0].outcome.points, 2);
});

test("mover un bloque conserva su dificultad, intención y resultado", async () => {
  const service = createTaskService(createMemoryTaskRepository([{ ...legacy("a"), blocks: [{ start: S, end: E30, difficulty: "facil", focusIntent: "Leer", outcome }] }]));
  await service.load();
  await service.moveBlock("a", "2026-11-03T09:00:00.000Z", "2026-11-03T09:20:00.000Z", 0);
  assert.deepEqual(service.getAll()[0].blocks[0], { start: "2026-11-03T09:00:00.000Z", end: "2026-11-03T09:20:00.000Z", difficulty: "facil", focusIntent: "Leer", outcome });
});

test("redimensionar por encima del límite de la dificultad se rechaza; un bloque antiguo no tiene límite", async () => {
  const service = createTaskService(createMemoryTaskRepository([
    { ...legacy("nuevo"), end: E30, blocks: [{ start: S, end: E30, difficulty: "facil" }] },
    legacy("viejo"),
  ]));
  await service.load();
  await assert.rejects(service.moveBlock("nuevo", S, E60, 0), /Fácil permite bloques de hasta 30 minutos/);
  assert.equal(service.getAll().find((t) => t.id === "nuevo").blocks[0].end, E30);
  await service.moveBlock("viejo", S, "2026-11-02T13:00:00.000Z", 0);
  assert.equal(service.getAll().find((t) => t.id === "viejo").end, "2026-11-02T13:00:00.000Z");
});

test("updateBlock acepta campos del bloque aparte de los de la tarea y no cambia la dificultad de un bloque resuelto", async () => {
  const service = createTaskService(createMemoryTaskRepository([{ ...legacy("a"), blocks: [{ start: S, end: E60 }, { start: "2026-11-02T11:00:00.000Z", end: "2026-11-02T11:30:00.000Z", difficulty: "facil", outcome }] }]));
  await service.load();
  await service.updateBlock("a", 0, { title: "A2", category: "hogar", start: S, end: E60 }, { difficulty: "intermedia" });
  const saved = service.getAll()[0];
  assert.equal(saved.title, "A2");
  assert.equal(saved.category, "hogar");
  assert.equal(saved.difficulty, undefined); // nunca se cuela en la tarea
  assert.equal(saved.blocks[0].difficulty, "intermedia");
  await assert.rejects(
    service.updateBlock("a", 1, { start: "2026-11-02T11:00:00.000Z", end: "2026-11-02T11:30:00.000Z" }, { difficulty: "moderada" }),
    /ya tiene resultado/
  );
});

test("addBlock con dificultad; sin ella funciona como antes", async () => {
  const service = createTaskService(createMemoryTaskRepository([legacy("a")]));
  await service.load();
  await service.addBlock("a", "2026-11-02T11:00:00.000Z", "2026-11-02T11:45:00.000Z", { difficulty: "moderada" });
  await service.addBlock("a", "2026-11-02T12:00:00.000Z", "2026-11-02T13:00:00.000Z");
  assert.deepEqual(service.getAll()[0].blocks.map((b) => b.difficulty), [undefined, "moderada", undefined]);
  await assert.rejects(service.addBlock("a", "2026-11-02T14:00:00.000Z", "2026-11-02T15:00:00.000Z", { difficulty: "facil" }), /hasta 30 minutos/);
});

test("modo demo: la categoría y los campos del bloque sobreviven a la recarga", async () => {
  const store = storage();
  const repo = () => createMemoryTaskRepository([], { storage: store, storageKey: "k" });
  const service = createTaskService(repo());
  await service.load();
  await service.add({ title: "Nueva", start: S, end: E30, category: "estudio", difficulty: "facil" });
  const reloaded = createTaskService(repo());
  await reloaded.load();
  assert.equal(reloaded.getAll()[0].category, "estudio");
  assert.equal(reloaded.getAll()[0].blocks[0].difficulty, "facil");
});
