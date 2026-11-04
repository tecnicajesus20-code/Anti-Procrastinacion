import { test } from "node:test";
import assert from "node:assert/strict";
import { TASK_STATUS, validateTask, buildTaskData, getTaskBlocks, toggledStatus, isDone, byStart } from "../../public/src/domain/task.js";
import {
  POMODORO_MODE,
  POMODORO_DEFAULTS,
  nextMode,
  planPomodoroBlock,
  summarizePomodoroTask,
} from "../../public/src/domain/pomodoro.js";

const valid = { title: "A", status: "pending", start: "2026-11-02T09:00:00.000Z", end: "2026-11-02T10:00:00.000Z" };

test("validateTask acepta una tarea válida", () => assert.deepEqual(validateTask(valid), []));

test("validateTask: mensajes exactos (los ve el usuario)", () => {
  assert.deepEqual(validateTask({ ...valid, title: "  " }), ["El título es obligatorio."]);
  assert.deepEqual(validateTask({ ...valid, status: "x" }), ["El estado no es válido."]);
  assert.deepEqual(validateTask({ ...valid, start: null }), ["La tarea necesita un bloque horario (inicio y fin)."]);
  assert.deepEqual(validateTask({ ...valid, end: valid.start }), ["La hora de fin debe ser posterior a la de inicio."]);
  assert.deepEqual(validateTask({ ...valid, dueDate: "nope" }), ["La fecha límite no es válida."]);
  assert.deepEqual(validateTask({ ...valid, blocks: [{ start: valid.end, end: valid.start }] }),
    ["Cada bloque necesita una hora de fin posterior a la de inicio."]);
  assert.deepEqual(validateTask({ ...valid, blocks: [] }), ["La tarea necesita al menos un bloque horario."]);
  assert.deepEqual(validateTask({
    ...valid,
    blocks: [{ start: valid.start, end: valid.end }, { start: "2026-11-02T09:30:00.000Z", end: "2026-11-02T10:30:00.000Z" }],
  }), ["Los bloques de una misma tarea no pueden repetir ni superponer horarios."]);
});

test("buildTaskData normaliza", () => {
  assert.deepEqual(buildTaskData({ title: "  T ", description: "  ", start: "s", end: "e" }),
    { title: "T", description: null, status: "pending", dueDate: null, start: "s", end: "e", blocks: [{ start: "s", end: "e" }] });
  assert.equal(buildTaskData({ title: "T", description: " d " }).description, "d");
  assert.equal(buildTaskData({ status: "done" }).status, "done");
});

test("getTaskBlocks admite tareas antiguas y devuelve copias", () => {
  const legacy = { start: "a", end: "b" };
  assert.deepEqual(getTaskBlocks(legacy), [{ start: "a", end: "b" }]);
  const task = { ...legacy, blocks: [{ start: "c", end: "d" }, { start: "e", end: "f" }] };
  const blocks = getTaskBlocks(task);
  blocks[0].start = "mutado";
  assert.equal(task.blocks[0].start, "c");
});

test("toggledStatus: done ⇄ pending; in_progress → done", () => {
  assert.equal(toggledStatus(TASK_STATUS.DONE), TASK_STATUS.PENDING);
  assert.equal(toggledStatus(TASK_STATUS.PENDING), TASK_STATUS.DONE);
  assert.equal(toggledStatus(TASK_STATUS.IN_PROGRESS), TASK_STATUS.DONE);
});

test("isDone y byStart", () => {
  assert.equal(isDone({ status: "done" }), true);
  assert.deepEqual([{ start: "b" }, { start: "a" }].sort(byStart).map((t) => t.start), ["a", "b"]);
});

test("pomodoro: modos y duraciones", () => {
  assert.equal(nextMode(POMODORO_MODE.WORK), POMODORO_MODE.BREAK);
  assert.equal(nextMode(POMODORO_MODE.BREAK), POMODORO_MODE.WORK);
  assert.deepEqual({ ...POMODORO_DEFAULTS }, { workSeconds: 1500, breakSeconds: 300 });
});

test("plan Pomodoro cubre el bloque completo con ciclos y enfoques residuales", () => {
  const plan = planPomodoroBlock({
    start: "2026-11-02T09:00:00.000Z",
    end: "2026-11-02T10:00:00.000Z",
  }, 0);

  assert.deepEqual(plan.map(({ kind, start, end }) => [kind, start, end]), [
    ["focus", "2026-11-02T09:00:00.000Z", "2026-11-02T09:25:00.000Z"],
    ["break", "2026-11-02T09:25:00.000Z", "2026-11-02T09:30:00.000Z"],
    ["focus", "2026-11-02T09:30:00.000Z", "2026-11-02T09:55:00.000Z"],
    ["break", "2026-11-02T09:55:00.000Z", "2026-11-02T10:00:00.000Z"],
  ]);
  assert.deepEqual(planPomodoroBlock({
    start: "2026-11-02T09:00:00.000Z",
    end: "2026-11-02T09:40:00.000Z",
  }, 0).map(({ kind, durationSeconds }) => [kind, durationSeconds]), [
    ["focus", 25 * 60],
    ["break", 5 * 60],
    ["focus", 10 * 60],
  ]);
  assert.deepEqual(planPomodoroBlock({
    start: "2026-11-02T09:00:00.000Z",
    end: "2026-11-02T09:20:00.000Z",
  }, 0), []);
});

test("plan Pomodoro conserva exactamente los bloques de 30, 45, 50, 60 y 90 minutos", () => {
  const expected = new Map([
    [30, [["focus", 25], ["break", 5]]],
    [45, [["focus", 25], ["break", 5], ["focus", 15]]],
    [50, [["focus", 25], ["break", 5], ["focus", 20]]],
    [60, [["focus", 25], ["break", 5], ["focus", 25], ["break", 5]]],
    [90, [["focus", 25], ["break", 5], ["focus", 25], ["break", 5], ["focus", 25], ["break", 5]]],
  ]);

  for (const [minutes, intervals] of expected) {
    const start = Date.parse("2026-11-02T09:00:00.000Z");
    const plan = planPomodoroBlock({
      start: new Date(start).toISOString(),
      end: new Date(start + minutes * 60_000).toISOString(),
    }, 0);

    assert.deepEqual(plan.map(({ kind, durationSeconds }) => [kind, durationSeconds / 60]), intervals);
    assert.equal(plan.reduce((total, slot) => total + slot.durationSeconds, 0), minutes * 60);
    assert.equal(Date.parse(plan.at(-1).end), start + minutes * 60_000);
  }
});

test("cumplimiento Pomodoro requiere al menos 80% de sesiones verificadas", () => {
  const task = {
    id: "task-80",
    start: "2026-11-02T09:00:00.000Z",
    end: "2026-11-02T11:30:00.000Z",
  };
  const plan = planPomodoroBlock({ start: task.start, end: task.end }, 0).filter((slot) => slot.kind === "focus");
  const sessions = (completed, failed = 0) => [
    ...plan.slice(0, completed).map((slot, index) => ({ id: `c${index}`, scheduleKey: slot.scheduleKey, status: "completed" })),
    ...plan.slice(completed, completed + failed).map((slot, index) => ({ id: `f${index}`, scheduleKey: slot.scheduleKey, status: "unfulfilled" })),
  ];

  assert.equal(plan.length, 5);
  assert.deepEqual(summarizePomodoroTask(task, sessions(4, 1)), {
    total: 5, completed: 4, completionRate: 80, status: "fulfilled",
  });
  assert.deepEqual(summarizePomodoroTask(task, sessions(3, 2)), {
    total: 5, completed: 3, completionRate: 60, status: "unfulfilled",
  });
  assert.equal(summarizePomodoroTask(task, sessions(3)).status, "pending");
});

test("el dominio no importa nada externo", async () => {
  const fs = await import("node:fs");
  for (const f of ["task.js", "pomodoro.js"]) {
    assert.doesNotMatch(fs.readFileSync(new URL(`../../public/src/domain/${f}`, import.meta.url), "utf8"), /^import /m);
  }
});
