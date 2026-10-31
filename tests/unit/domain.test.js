import { test } from "node:test";
import assert from "node:assert/strict";
import { TASK_STATUS, validateTask, buildTaskData, toggledStatus, isDone, byStart } from "../../public/src/domain/task.js";
import { POMODORO_MODE, POMODORO_DEFAULTS, nextMode } from "../../public/src/domain/pomodoro.js";

const valid = { title: "A", status: "pending", start: "2026-11-02T09:00:00.000Z", end: "2026-11-02T10:00:00.000Z" };

test("validateTask acepta una tarea válida", () => assert.deepEqual(validateTask(valid), []));

test("validateTask: mensajes exactos (los ve el usuario)", () => {
  assert.deepEqual(validateTask({ ...valid, title: "  " }), ["El título es obligatorio."]);
  assert.deepEqual(validateTask({ ...valid, status: "x" }), ["El estado no es válido."]);
  assert.deepEqual(validateTask({ ...valid, start: null }), ["La tarea necesita un bloque horario (inicio y fin)."]);
  assert.deepEqual(validateTask({ ...valid, end: valid.start }), ["La hora de fin debe ser posterior a la de inicio."]);
  assert.deepEqual(validateTask({ ...valid, dueDate: "nope" }), ["La fecha límite no es válida."]);
});

test("buildTaskData normaliza", () => {
  assert.deepEqual(buildTaskData({ title: "  T ", description: "  ", start: "s", end: "e" }),
    { title: "T", description: null, status: "pending", dueDate: null, start: "s", end: "e" });
  assert.equal(buildTaskData({ title: "T", description: " d " }).description, "d");
  assert.equal(buildTaskData({ status: "done" }).status, "done");
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

test("el dominio no importa nada externo", async () => {
  const fs = await import("node:fs");
  for (const f of ["task.js", "pomodoro.js"]) {
    assert.doesNotMatch(fs.readFileSync(new URL(`../../public/src/domain/${f}`, import.meta.url), "utf8"), /^import /m);
  }
});
