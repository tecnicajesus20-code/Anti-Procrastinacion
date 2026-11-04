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

async function setup(end = "2026-11-02T09:00:03.000Z", { storage = null, breakSeconds = 1 } = {}) {
  const start = "2026-11-02T09:00:00.000Z";
  const taskRepository = createMemoryTaskRepository([{
    id: "task-session",
    title: "Preparar entrega",
    description: null,
    status: "pending",
    dueDate: null,
    start,
    end,
    blocks: [{ start, end }],
  }], storage ? { storage, storageKey: "demo-tasks" } : {});
  const taskService = createTaskService(taskRepository);
  await taskService.load();

  const clock = fakeClock();
  const pomodoro = createPomodoroService({ workSeconds: 2, breakSeconds, clock });
  let currentTime = new Date("2026-11-02T09:00:00.000Z");
  let nextId = 0;
  const errors = [];
  const sessions = createPomodoroSessionService({
    taskService,
    pomodoro,
    workSeconds: 2,
    breakSeconds,
    now: () => new Date(currentTime),
    createId: () => `session-${++nextId}`,
    storage,
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

test("restaura automáticamente una sesión persistida usando su marca de tiempo", async () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const { pomodoro, sessions, advanceTime } = await setup(undefined, { storage });
  await sessions.start("task-session", 0);
  pomodoro.pause();
  advanceTime(1);
  const reloadedTaskService = createTaskService(createMemoryTaskRepository([], {
    storage,
    storageKey: "demo-tasks",
  }));
  await reloadedTaskService.load();
  const restoredPomodoro = createPomodoroService({
    workSeconds: 2,
    breakSeconds: 1,
    clock: fakeClock(),
  });

  const restored = createPomodoroSessionService({
    taskService: reloadedTaskService,
    pomodoro: restoredPomodoro,
    workSeconds: 2,
    breakSeconds: 1,
    now: () => new Date("2026-11-02T09:00:01.000Z"),
    storage,
    onError: (error) => { throw error; },
  });
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(restored.getCurrentSession().actualDurationSeconds, 1);
  assert.equal(restored.getCurrentSession().runningSince, "2026-11-02T09:00:01.000Z");
  assert.equal(restored.getState().timer.remaining, 1);
  assert.equal(restored.getState().timer.running, true);
});

test("inicia el siguiente ciclo automáticamente al terminar el descanso programado", async () => {
  const { taskService, clock, sessions } = await setup("2026-11-02T09:00:05.000Z");
  await sessions.start("task-session", 0);
  clock.tick(2);
  await new Promise((resolve) => setTimeout(resolve, 0));
  await sessions.confirm("task-session", taskService.getAll()[0].pomodoroSessions[0].id);

  assert.equal(sessions.getState().timer.mode, "break");
  clock.tick(1);
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(taskService.getAll()[0].pomodoroSessions.length, 2);
  assert.equal(sessions.getCurrentSession().sessionIndex, 1);
  assert.equal(sessions.getState().timer.remaining, 2);
  assert.equal(sessions.getState().timer.running, true);
});

test("restaura un descanso en curso después de recargar y descuenta el tiempo transcurrido", async () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const { taskService, clock, pomodoro, sessions, advanceTime } = await setup(
    "2026-11-02T09:00:15.000Z",
    { storage, breakSeconds: 10 }
  );
  await sessions.start("task-session", 0);
  clock.tick(2);
  await new Promise((resolve) => setTimeout(resolve, 0));
  await sessions.confirm("task-session", taskService.getAll()[0].pomodoroSessions[0].id);
  advanceTime(3);
  pomodoro.pause();

  const restoredPomodoro = createPomodoroService({ workSeconds: 2, breakSeconds: 10, clock: fakeClock() });
  const restored = createPomodoroSessionService({
    taskService,
    pomodoro: restoredPomodoro,
    workSeconds: 2,
    breakSeconds: 10,
    now: () => new Date("2026-11-02T09:00:03.000Z"),
    storage,
    onError: (error) => { throw error; },
  });

  assert.equal(restored.getState().timer.mode, "break");
  assert.equal(restored.getState().timer.remaining, 7);
  assert.equal(restored.getState().timer.running, true);
  assert.equal(restored.getCurrentSession().status, "completed");
});

test("al recargar después de vencer el descanso inicia el siguiente enfoque pendiente", async () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const { taskService, clock, sessions } = await setup(
    "2026-11-02T09:00:15.000Z",
    { storage, breakSeconds: 10 }
  );
  await sessions.start("task-session", 0);
  clock.tick(2);
  await new Promise((resolve) => setTimeout(resolve, 0));
  await sessions.confirm("task-session", taskService.getAll()[0].pomodoroSessions[0].id);

  const reloadedTaskService = createTaskService(createMemoryTaskRepository([], {
    storage,
    storageKey: "demo-tasks",
  }));
  await reloadedTaskService.load();
  const restored = createPomodoroSessionService({
    taskService: reloadedTaskService,
    pomodoro: createPomodoroService({ workSeconds: 2, breakSeconds: 10, clock: fakeClock() }),
    workSeconds: 2,
    breakSeconds: 10,
    now: () => new Date("2026-11-02T09:00:11.000Z"),
    storage,
    onError: (error) => { throw error; },
  });
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(reloadedTaskService.getAll()[0].pomodoroSessions.length, 2);
  assert.equal(restored.getCurrentSession().sessionIndex, 1);
  assert.equal(restored.getState().timer.mode, "work");
  assert.equal(restored.getState().timer.remaining, 2);
  assert.equal(restored.getState().timer.running, true);
});

test("restaura un descanso pausado y permite reanudarlo", async () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const { taskService, clock, sessions, advanceTime } = await setup(
    "2026-11-02T09:00:15.000Z",
    { storage, breakSeconds: 10 }
  );
  await sessions.start("task-session", 0);
  clock.tick(2);
  await new Promise((resolve) => setTimeout(resolve, 0));
  await sessions.confirm("task-session", taskService.getAll()[0].pomodoroSessions[0].id);
  await sessions.pause();
  advanceTime(5);

  const restored = createPomodoroSessionService({
    taskService,
    pomodoro: createPomodoroService({ workSeconds: 2, breakSeconds: 10, clock: fakeClock() }),
    workSeconds: 2,
    breakSeconds: 10,
    now: () => new Date("2026-11-02T09:00:05.000Z"),
    storage,
    onError: (error) => { throw error; },
  });

  assert.equal(restored.getState().timer.mode, "break");
  assert.equal(restored.getState().timer.remaining, 10);
  assert.equal(restored.getState().timer.running, false);
  restored.resumeBreak();
  assert.equal(restored.getState().timer.running, true);
});

test("separa el checkpoint del descanso al cambiar de modo demo a cuenta", async () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const { taskService, clock, pomodoro, sessions } = await setup(
    "2026-11-02T09:00:15.000Z",
    { storage, breakSeconds: 10 }
  );
  await sessions.start("task-session", 0);
  clock.tick(2);
  await new Promise((resolve) => setTimeout(resolve, 0));
  await sessions.confirm("task-session", taskService.getAll()[0].pomodoroSessions[0].id);
  await sessions.pause();
  assert.ok(values.has("antiprocrastinacion:pomodoro-break:v1:guest"));

  sessions.setStorageScope("account-2");

  assert.equal(values.has("antiprocrastinacion:pomodoro-break:v1:account-2"), false);
  assert.equal(sessions.getState().timer.mode, "work");
  assert.equal(sessions.getState().timer.running, false);
  assert.equal(sessions.getCurrentSession(), null);
});

test("reiniciar durante el descanso cancela la transición automática al siguiente ciclo", async () => {
  const { taskService, clock, pomodoro, sessions } = await setup("2026-11-02T09:00:05.000Z");
  await sessions.start("task-session", 0);
  clock.tick(2);
  await new Promise((resolve) => setTimeout(resolve, 0));
  await sessions.confirm("task-session", taskService.getAll()[0].pomodoroSessions[0].id);
  await sessions.reset();
  clock.tick(1);
  let timerState;
  pomodoro.onTick((state) => { timerState = state; });

  assert.equal(taskService.getAll()[0].pomodoroSessions.length, 1);
  assert.equal(timerState.mode, "work");
  assert.equal(timerState.running, false);
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
