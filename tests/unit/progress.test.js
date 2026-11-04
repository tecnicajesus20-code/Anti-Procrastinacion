import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isBlockCompleted, scoreSummary, pointsHistory, timeByCategory, productivitySummary, productiveHours,
  weeklyFreeTime, weeklyEvolution, UNCATEGORIZED,
} from "../../public/src/domain/progress.js";
import { mergeCategories } from "../../public/src/domain/category.js";
import { buildBlockOutcome } from "../../public/src/domain/block-outcome.js";
import { createTaskService } from "../../public/src/application/task.service.js";
import { createBlockOutcomeService } from "../../public/src/application/block-outcome.service.js";
import { createMemoryTaskRepository } from "../../public/src/infrastructure/memory/task.memory.repository.js";
import { createProfileService } from "../../public/src/application/profile.service.js";

const at = (day, hh, mm = 0) => new Date(2026, 10, day, hh, mm).toISOString(); // noviembre 2026, hora local
const categories = mergeCategories([]);
const done = (points, day = 20) => ({ status: "completed", points, resolvedAt: at(day, 23), source: "user" });
const failed = (points, day = 20) => ({ status: "not_completed", points: -points, resolvedAt: at(day, 23, 30), source: "timeout" });
const NOW = new Date(2026, 10, 19, 20); // jueves 19 nov 2026, 20:00 (semana del lunes 16)

test("Score = Impulsos − Desvíos, sumando los resultados guardados en los bloques", () => {
  const tasks = [
    { id: "a", title: "A", status: "pending", category: "estudio", start: at(16, 9), end: at(16, 10), blocks: [
      { start: at(16, 9), end: at(16, 10), difficulty: "intermedia", outcome: done(12) },
      { start: at(17, 9), end: at(17, 10), difficulty: "intermedia", outcome: failed(2) },
    ] },
    { id: "b", title: "B", status: "pending", start: at(18, 9), end: at(18, 9, 30), blocks: [
      { start: at(18, 9), end: at(18, 9, 30), difficulty: "facil" }, // sin respuesta: no suma ni resta
    ] },
  ];
  assert.deepEqual(scoreSummary(tasks), { impulses: 12, deviations: 2, score: 10, completedBlocks: 1, failedBlocks: 1 });
});

test("sin puntos duplicados: el mismo bloque no acepta un segundo resultado y el Score no cambia", async () => {
  const block = { start: at(16, 9), end: at(16, 10), difficulty: "intermedia" };
  const repo = createMemoryTaskRepository([{ id: "t", title: "T", status: "pending", description: null, dueDate: null, start: block.start, end: block.end, blocks: [block] }]);
  const taskService = createTaskService(repo);
  await taskService.load();
  const outcomes = createBlockOutcomeService({ taskService, now: () => new Date(2026, 10, 16, 11) });
  await outcomes.answer("t", 0, true);
  await assert.rejects(outcomes.answer("t", 0, true), /ya tiene un resultado/);
  await assert.rejects(outcomes.expire("t", 0), /ya tiene un resultado/);
  // Mover el bloque conserva su resultado: no se "libera" para volver a puntuar.
  await taskService.moveBlock("t", at(16, 9, 30), at(16, 10, 30), 0);
  await assert.rejects(outcomes.answer("t", 0, false), /ya tiene un resultado/);
  assert.deepEqual(scoreSummary(taskService.getAll()), { impulses: 12, deviations: 0, score: 12, completedBlocks: 1, failedBlocks: 0 });
  assert.equal(pointsHistory(taskService.getAll(), categories).length, 1);
});

test("Desvío = 20 % del valor del bloque (mucho menos que el Impulso)", () => {
  const block = { start: at(16, 9), end: at(16, 12), difficulty: "hardcore" }; // 180 min × 5 / 15 = 60 puntos
  assert.equal(buildBlockOutcome(block, "completed", { now: NOW }).points, 60);
  assert.equal(buildBlockOutcome(block, "not_completed", { now: NOW }).points, -12);
});

test("historial: un movimiento por bloque con resultado, más reciente primero, con tarea, categoría y bloque", () => {
  const tasks = [
    { id: "a", title: "Estudiar", category: "estudio", status: "pending", start: at(16, 9), end: at(16, 10), blocks: [
      { start: at(16, 9), end: at(16, 10), difficulty: "intermedia", outcome: done(12, 16) },
      { start: at(17, 9), end: at(17, 10), difficulty: "intermedia", outcome: failed(2, 17) },
    ] },
    { id: "b", title: "Vieja", status: "done", start: at(18, 9), end: at(18, 10) }, // sin outcome: no es movimiento
  ];
  const history = pointsHistory(tasks, categories);
  assert.deepEqual(history.map((m) => [m.type, m.points, m.taskId, m.blockIndex, m.category.id]), [
    ["desvio", 2, "a", 1, "estudio"],
    ["impulso", 12, "a", 0, "estudio"],
  ]);
  assert.equal(history[0].taskTitle, "Estudiar");
  assert.equal(history[0].blockStart, at(17, 9));
  assert.equal(history[0].source, "timeout");
});

test("bloque completado: solo con respuesta; las tareas antiguas solo si están terminadas y el bloque pasó", () => {
  const nowMs = NOW.getTime();
  const scored = { status: "done", blocks: [] };
  assert.equal(isBlockCompleted(scored, { start: at(16, 9), end: at(16, 10), difficulty: "facil" }, nowMs), false);
  assert.equal(isBlockCompleted(scored, { start: at(16, 9), end: at(16, 10), difficulty: "facil", outcome: done(2) }, nowMs), true);
  assert.equal(isBlockCompleted({ status: "done" }, { start: at(16, 9), end: at(16, 10) }, nowMs), true);
  assert.equal(isBlockCompleted({ status: "pending" }, { start: at(16, 9), end: at(16, 10) }, nowMs), false);
  assert.equal(isBlockCompleted({ status: "done" }, { start: at(25, 9), end: at(25, 10) }, nowMs), false); // futuro
});

test("distribución por categoría: usa la DURACIÓN de los bloques completados, no el número de tareas", () => {
  const tasks = [
    { id: "a", category: "estudio", status: "pending", start: at(16, 8), end: at(16, 11), blocks: [
      { start: at(16, 8), end: at(16, 11), difficulty: "hardcore", outcome: done(60) }, // 180 min
    ] },
    { id: "b", category: "trabajo", status: "pending", start: at(17, 8), end: at(17, 8, 30), blocks: [
      { start: at(17, 8), end: at(17, 8, 30), difficulty: "facil", outcome: done(2) }, // 30 min
    ] },
    { id: "c", category: "trabajo", status: "pending", start: at(17, 9), end: at(17, 9, 30), blocks: [
      { start: at(17, 9), end: at(17, 9, 30), difficulty: "facil", outcome: done(2) }, // 30 min
    ] },
    { id: "d", category: "hogar", status: "pending", start: at(17, 12), end: at(17, 14), blocks: [
      { start: at(17, 12), end: at(17, 14), difficulty: "desafio", outcome: failed(6) }, // no completado: no cuenta
    ] },
    { id: "e", status: "done", start: at(18, 10), end: at(18, 11) }, // antigua terminada, sin categoría: 60 min
  ];
  const result = timeByCategory(tasks, categories, { nowMs: NOW.getTime() });
  assert.equal(result.totalMinutes, 300);
  assert.deepEqual(result.items.map((i) => [i.category.id, i.minutes, Math.round(i.share * 100)]), [
    ["estudio", 180, 60], ["sin_categoria", 60, 20], ["trabajo", 60, 20],
  ]);
  assert.equal(result.top.category.name, "Estudio");
  assert.equal(result.items[1].category, UNCATEGORIZED);
});

test("productividad: enfocado ≠ programado; Pomodoro manda cuando existe; comparación y promedio semanal", () => {
  const session = (start, seconds, status = "completed") => ({
    id: `s-${start}`, taskId: "p", blockIndex: 0, sessionIndex: 0, scheduleKey: `0:${start}`, scheduledStart: start,
    scheduledEnd: start, plannedDurationSeconds: 1500, actualDurationSeconds: seconds, startedAt: start,
    endedAt: start, runningSince: null, status, failureReason: null,
  });
  const tasks = [
    // Semana actual: bloque de 60 min con 2 Pomodoros completados (25 + 20 min reales) → 45 min enfocados
    { id: "p", status: "pending", start: at(16, 9), end: at(16, 10), blocks: [{ start: at(16, 9), end: at(16, 10), difficulty: "intermedia", outcome: done(12) }],
      pomodoroSessions: [session(at(16, 9), 1500), session(at(16, 9, 30), 1200), session(at(16, 9, 55), 300, "unfulfilled")] },
    // Semana actual: completado sin Pomodoro → cuenta su duración (30 min)
    { id: "q", status: "pending", start: at(17, 9), end: at(17, 9, 30), blocks: [{ start: at(17, 9), end: at(17, 9, 30), difficulty: "facil", outcome: done(2) }] },
    // Semana actual: programado pero sin respuesta → 0 enfocado (no se supone)
    { id: "r", status: "pending", start: at(18, 9), end: at(18, 11), blocks: [{ start: at(18, 9), end: at(18, 11), difficulty: "desafio" }] },
    // Semana anterior: 60 min completados
    { id: "s", status: "pending", start: at(10, 9), end: at(10, 10), blocks: [{ start: at(10, 9), end: at(10, 10), difficulty: "intermedia", outcome: done(12, 10) }] },
  ];
  const data = productivitySummary(tasks, NOW);
  assert.deepEqual(data.thisWeek, { focusMinutes: 75, scheduledMinutes: 210, completedMinutes: 90 });
  assert.equal(data.lastWeek.focusMinutes, 60);
  assert.equal(data.changePct, 25);
  assert.equal(data.totalFocusMinutes, 135);
  assert.equal(data.daysElapsed, 4); // lunes a jueves
  assert.equal(data.dailyAverageMinutes, 19);
  assert.equal(data.pomodoroMeasuredBlocks, 1);
  assert.equal(productivitySummary([tasks[0]], NOW).changePct, null); // sin semana anterior: no se compara
});

test("horarios productivos: gana la franja con más bloques COMPLETADOS, no la de más tiempo programado", () => {
  const blk = (day, h, outcome, minutes = 30) => ({ start: at(day, h), end: new Date(Date.parse(at(day, h)) + minutes * 60_000).toISOString(), difficulty: "hardcore", outcome });
  const tasks = [
    { id: "a", category: "estudio", status: "pending", start: at(16, 9), end: at(16, 9, 30), blocks: [blk(16, 9, done(2)), blk(17, 9, done(2))] },
    { id: "b", category: "trabajo", status: "pending", start: at(18, 9), end: at(18, 9, 30), blocks: [blk(18, 9, done(2), 15)] },
    // 15 h: mucho tiempo programado pero no cumplido
    { id: "c", category: "hogar", status: "pending", start: at(16, 15), end: at(16, 19), blocks: [blk(16, 15, failed(4), 240), blk(17, 15, failed(4), 240)] },
  ];
  const { hours, best } = productiveHours(tasks, categories, NOW.getTime());
  assert.equal(best.hour, 9);
  assert.equal(best.completed, 3);
  assert.equal(best.rate, 1);
  assert.equal(best.category.id, "estudio"); // 60 min de Estudio frente a 15 de Trabajo
  assert.deepEqual([hours[15].completed, hours[15].failed, hours[15].rate], [0, 2, 0]);
  assert.equal(productiveHours([], categories, NOW.getTime()).best, null);
});

test("tiempo libre semanal: huecos entre bloques sin contar solapes; con menos de 2 bloques no hay datos suficientes", () => {
  const tasks = [
    { id: "a", status: "pending", start: at(16, 8), end: at(16, 9) },
    { id: "b", status: "pending", start: at(16, 8, 30), end: at(16, 10) }, // se solapa con a
    { id: "c", status: "pending", start: at(16, 12), end: at(16, 13) },
  ];
  const result = weeklyFreeTime(tasks, NOW);
  assert.equal(result.enoughData, true);
  assert.equal(result.totalMinutes, 120); // 10:00–12:00
  assert.equal(weeklyFreeTime([tasks[0]], NOW).enoughData, false);
});

test("evolución semanal: 8 semanas en orden, con Score acumulado", () => {
  const tasks = [
    { id: "a", status: "pending", start: at(10, 9), end: at(10, 10), blocks: [
      { start: at(10, 9), end: at(10, 10), difficulty: "intermedia", outcome: done(12, 10) },
    ] },
    { id: "b", status: "pending", start: at(17, 9), end: at(17, 10), blocks: [
      { start: at(17, 9), end: at(17, 10), difficulty: "intermedia", outcome: failed(2, 17) },
      { start: at(18, 9), end: at(18, 10), difficulty: "intermedia", outcome: done(12, 18) },
    ] },
  ];
  const weeks = weeklyEvolution(tasks, NOW, 8);
  assert.equal(weeks.length, 8);
  assert.equal(weeks[7].from.getDate(), 16); // la última es la semana actual (lunes 16)
  assert.ok(weeks.every((week, i) => i === 0 || week.from > weeks[i - 1].from));
  assert.deepEqual([weeks[6].focusMinutes, weeks[6].completed, weeks[6].failed, weeks[6].score], [60, 1, 0, 12]);
  assert.deepEqual([weeks[7].focusMinutes, weeks[7].completed, weeks[7].failed, weeks[7].score], [60, 1, 1, 22]);
  assert.equal(weeks[0].score, 0);
});

test("los cálculos no modifican las tareas", () => {
  const tasks = [{ id: "a", status: "done", start: at(16, 9), end: at(16, 10), blocks: [{ start: at(16, 9), end: at(16, 10), difficulty: "intermedia", outcome: done(12) }] }];
  const snapshot = JSON.stringify(tasks);
  scoreSummary(tasks); pointsHistory(tasks, categories); timeByCategory(tasks, categories, { nowMs: NOW.getTime() });
  productivitySummary(tasks, NOW); productiveHours(tasks, categories, NOW.getTime()); weeklyFreeTime(tasks, NOW); weeklyEvolution(tasks, NOW);
  assert.equal(JSON.stringify(tasks), snapshot);
});

/* ---------------------------------------------------------------- PERFIL EDITABLE */

const memoryProfileRepo = (initial) => {
  let stored = initial;
  return {
    saves: 0,
    async get() { return stored; },
    async save(data) {
      this.saves += 1;
      stored = { displayName: data.displayName, photo: data.photo ?? null, createdAt: stored?.createdAt ?? "2026-11-01T00:00:00.000Z", updatedAt: "2026-11-19T00:00:00.000Z" };
      return stored;
    },
  };
};

test("perfil editable: guarda nombre y foto, conserva la fecha de alta y nunca guarda el correo", async () => {
  const service = createProfileService();
  const repo = memoryProfileRepo({ displayName: "Ana", photo: null, createdAt: "2026-11-01T00:00:00.000Z" });
  await service.useRepository(repo);
  const saved = await service.update({ displayName: "  Ana Pérez ", photo: "data:image/jpeg;base64,AAA", email: "otro@x.com" });
  assert.deepEqual(saved, { displayName: "Ana Pérez", photo: "data:image/jpeg;base64,AAA", createdAt: "2026-11-01T00:00:00.000Z", updatedAt: "2026-11-19T00:00:00.000Z" });
  assert.equal(service.getProfile().displayName, "Ana Pérez");
  assert.ok(!("email" in service.getProfile()));
});

test("perfil editable: valida antes de guardar y exige sesión", async () => {
  const service = createProfileService();
  await assert.rejects(service.update({ displayName: "Ana" }), /Inicia sesión/);
  const repo = memoryProfileRepo({ displayName: "Ana", photo: null, createdAt: "2026-11-01T00:00:00.000Z" });
  await service.useRepository(repo);
  await assert.rejects(service.update({ displayName: "   " }), /obligatorio/);
  await assert.rejects(service.update({ displayName: "Ana", photo: "no-es-imagen" }), /foto no es válida/);
  assert.equal(repo.saves, 0);
});

test("perfil editable: aislamiento entre usuarios (un guardado tardío no pisa el perfil del siguiente)", async () => {
  const service = createProfileService();
  let release;
  const slowAna = { get: async () => ({ displayName: "Ana", createdAt: "x" }), save: (data) => new Promise((resolve) => { release = () => resolve({ ...data, createdAt: "x" }); }) };
  await service.useRepository(slowAna);
  const pending = service.update({ displayName: "Ana nueva" });
  await service.useRepository(memoryProfileRepo({ displayName: "Beto", photo: null, createdAt: "y" }));
  release();
  await pending;
  assert.equal(service.getProfile().displayName, "Beto");
});
