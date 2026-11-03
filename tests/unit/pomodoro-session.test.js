import { test } from "node:test";
import assert from "node:assert/strict";
import { createPomodoroService } from "../../public/src/application/pomodoro.service.js";
import { createPomodoroSessionService } from "../../public/src/application/pomodoro-session.service.js";
import { createTaskService } from "../../public/src/application/task.service.js";
import { createMemoryTaskRepository } from "../../public/src/infrastructure/memory/task.memory.repository.js";

function fakeClock() {
  const timers = new Map();
  let nextId = 0;
  return {
    setInterval(callback) {
      const id = ++nextId;
      timers.set(id, callback);
      return id;
    },
    clearInterval(id) { timers.delete(id); },
    tick(seconds = 1) {
      for (let second = 0; second < seconds; second += 1) {
        [...timers.values()].forEach((callback) => callback());
      }
    },
    count: () => timers.size,
  };
}

async function setup(end = "2026-11-02T09:00:03.000Z") {
  const start = "2026-11-02T09:00:00.000Z";
  const taskService = createTaskService(createMemoryTaskRepository([{
    id: "task-session",
    title: "Preparar entrega",
    description: null,
    status: "pending",
    dueDate: null,
    start,
    end,
    blocks: [{ start, end }],
  }]));
  await taskService.load();

  const clock = fakeClock();
  const pomodoro = createPomodoroService({ workSeconds: 2, breakSeconds: 1, clock });
  let currentTime = new Date("2026-11-02T09:00:00.000Z");
  let nextId = 0;
  const errors = [];
  const sessions = createPomodoroSessionService({
    taskService,
    pomodoro,
    workSeconds: 2,
    breakSeconds: 1,
    now: () => new Date(currentTime),
    createId: () => `session-${++nextId}`,
    onError: (error) => errors.push(error),
  });
  return {
    taskService,
    clock,
    pomodoro,
    sessions,
    errors,
    advanceTime(seconds) { currentTime = new Date(currentTime.getTime() + seconds * 1000); },
  };
}

test("una sesión de enfoque termina pendiente y requiere confirmación explícita", async () => {
  const { taskService, clock, sessions, errors } = await setup();
  await sessions.start("task-session", 0);
  clock.tick(2);
  await new Promise((resolve) => setTimeout(resolve, 0));

  let task = taskService.getAll()[0];
  assert.equal(task.pomodoroSessions[0].status, "pending");
  assert.ok(task.pomodoroSessions[0].endedAt);
  assert.equal(task.pomodoroSessions[0].actualDurationSeconds, 2);
  assert.equal(task.pomodoroCompletionRate, 0);
  assert.equal(sessions.getState().timer.awaitingConfirmation, true);

  await sessions.confirm(task.id, task.pomodoroSessions[0].id);
  task = taskService.getAll()[0];
  assert.equal(task.pomodoroSessions[0].status, "completed");
  assert.equal(task.pomodoroCompletionRate, 100);
  assert.equal(task.pomodoroStatus, "fulfilled");
  assert.deepEqual(errors, []);
});

test("inicia una sesión nueva cuando todavía no existe historial Pomodoro", async () => {
  const { taskService, clock, sessions } = await setup();
  await sessions.start("task-session", 0);

  const task = taskService.getAll()[0];
  assert.equal(task.pomodoroSessions.length, 1);
  assert.equal(task.pomodoroSessions[0].status, "pending");
  assert.equal(task.pomodoroSessions[0].actualDurationSeconds, 0);
  assert.equal(task.pomodoroSessions[0].runningSince, "2026-11-02T09:00:00.000Z");
  assert.equal(clock.count(), 1);
  assert.equal(sessions.getState().timer.running, true);
});

test("pausar conserva el tiempo trabajado y abandonar registra el motivo", async () => {
  const { taskService, clock, sessions } = await setup();
  await sessions.start("task-session", 0);
  clock.tick();
  await sessions.pause();

  let session = taskService.getAll()[0].pomodoroSessions[0];
  assert.equal(session.actualDurationSeconds, 1);
  assert.equal(session.runningSince, null);
  await sessions.markUnfulfilled("task-session", session.id, "Me interrumpieron");

  session = taskService.getAll()[0].pomodoroSessions[0];
  assert.equal(session.status, "unfulfilled");
  assert.equal(session.failureReason, "Me interrumpieron");
  assert.equal(session.actualDurationSeconds, 1);
  assert.equal(taskService.getAll()[0].pomodoroStatus, "unfulfilled");
});

test("reanudar suma solo el tiempo trabajado, no el tiempo en pausa", async () => {
  const { taskService, clock, sessions, advanceTime } = await setup();
  await sessions.start("task-session", 0);
  clock.tick();
  await sessions.pause();
  const sessionId = taskService.getAll()[0].pomodoroSessions[0].id;

  advanceTime(60);
  await sessions.resume("task-session", sessionId);
  clock.tick();
  await new Promise((resolve) => setTimeout(resolve, 0));

  const session = taskService.getAll()[0].pomodoroSessions[0];
  assert.equal(session.status, "pending");
  assert.equal(session.actualDurationSeconds, 2);
  assert.ok(session.endedAt);
});

test("una sesión pausada impide iniciar otro horario de enfoque", async () => {
  const { taskService, clock, sessions } = await setup("2026-11-02T09:00:05.000Z");
  await sessions.start("task-session", 0);
  clock.tick();
  await sessions.pause();

  await assert.rejects(
    sessions.start("task-session", 0, "0:2026-11-02T09:00:03.000Z"),
    /Termina o registra como incumplida/
  );
  assert.equal(taskService.getAll()[0].pomodoroSessions.length, 1);
});

test("reiniciar una sesión terminada sin confirmar la registra como incumplida", async () => {
  const { taskService, clock, sessions } = await setup();
  await sessions.start("task-session", 0);
  clock.tick(2);
  await new Promise((resolve) => setTimeout(resolve, 0));

  await sessions.reset();
  const session = taskService.getAll()[0].pomodoroSessions[0];
  assert.equal(session.status, "unfulfilled");
  assert.equal(session.actualDurationSeconds, 2);
  assert.equal(session.failureReason, "Sesión reiniciada por el usuario.");
});
