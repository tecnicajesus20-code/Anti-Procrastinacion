import { test } from "node:test";
import assert from "node:assert/strict";
import { createTaskService } from "../../public/src/application/task.service.js";
import { createSessionCoordinator } from "../../public/src/application/session.coordinator.js";
import { createPomodoroService } from "../../public/src/application/pomodoro.service.js";
import { assertTaskRepository } from "../../public/src/application/task-repository.js";
import { createMemoryTaskRepository } from "../../public/src/infrastructure/memory/task.memory.repository.js";

const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const T = (id, extra = {}) => ({ id, title: id, description: null, status: "pending", dueDate: null, start: "2026-11-02T09:00:00.000Z", end: "2026-11-02T10:00:00.000Z", ...extra });
const input = { title: "Nueva", start: "2026-11-02T09:00:00.000Z", end: "2026-11-02T10:00:00.000Z" };

/** Repositorio cuyas respuestas controla la prueba. */
function controlledRepo() {
  const pending = { list: deferred(), create: deferred() };
  return { pending, list: () => pending.list.promise, create: () => pending.create.promise, update: async () => T("x"), remove: async () => {} };
}

test("assertTaskRepository rechaza objetos incompletos", () => {
  assert.throws(() => assertTaskRepository({ list() {} }), /create, update, remove/);
  assert.throws(() => createTaskService(null), TypeError);
});

test("CRUD básico y notificación con copias", async () => {
  const service = createTaskService(createMemoryTaskRepository([T("a")]));
  const seen = [];
  service.subscribe((tasks) => seen.push(tasks.map((t) => `${t.title}:${t.status}`)));
  await service.load();
  const created = await service.add(input);
  await service.toggleDone(created.id);
  await service.toggleDone(created.id);
  await service.moveBlock("a", "2026-11-03T09:00:00.000Z", "2026-11-03T11:00:00.000Z");
  await service.remove("a");
  assert.deepEqual(seen, [["a:pending"], ["a:pending", "Nueva:pending"], ["a:pending", "Nueva:done"], ["a:pending", "Nueva:pending"], ["a:pending", "Nueva:pending"], ["Nueva:pending"]]);
  service.getAll()[0].title = "mutado";
  assert.equal(service.getAll()[0].title, "Nueva");
});

test("validación: errores del dominio y tarea inexistente (como promesa rechazada)", async () => {
  const service = createTaskService(createMemoryTaskRepository([T("a")]));
  await service.load();
  await assert.rejects(service.add({ ...input, title: " " }), { message: "El título es obligatorio." });
  await assert.rejects(service.moveBlock("a", input.end, input.start), { message: "La hora de fin debe ser posterior a la de inicio." });
  await assert.rejects(service.update("zz", {}), { message: "No existe la tarea zz" });
  await assert.rejects(service.toggleDone("zz"), { message: "No existe la tarea zz" });
});

test("AUD-01: una carga obsoleta no sobrescribe la sesión actual", async () => {
  const userRepo = controlledRepo();
  const service = createTaskService(createMemoryTaskRepository());
  const loadingUser = service.useRepository(userRepo);           // login (lento)
  const loadingGuest = service.useRepository(createMemoryTaskRepository([T("demo")])); // logout (rápido)
  assert.equal(await loadingGuest, true);
  userRepo.pending.list.resolve([T("privada")]);
  assert.equal(await loadingUser, false);
  assert.deepEqual(service.getAll().map((t) => t.id), ["demo"]);
});

test("AUD-01: el error de una carga obsoleta no se propaga", async () => {
  const userRepo = controlledRepo();
  const service = createTaskService(createMemoryTaskRepository());
  const loadingUser = service.useRepository(userRepo);
  await service.useRepository(createMemoryTaskRepository());
  userRepo.pending.list.reject(new Error("permission-denied"));
  assert.equal(await loadingUser, false);
});

test("AUD-01: una escritura en vuelo no se mezcla con otra sesión (pero sí se devuelve)", async () => {
  const userRepo = controlledRepo();
  const service = createTaskService(userRepo);
  const creating = service.add(input);
  await service.useRepository(createMemoryTaskRepository([T("demo")]));
  userRepo.pending.create.resolve(T("de-ana"));
  assert.equal((await creating).id, "de-ana");
  assert.deepEqual(service.getAll().map((t) => t.id), ["demo"]);
});

test("recargar el mismo repositorio NO descarta escrituras en curso", async () => {
  const repo = createMemoryTaskRepository();
  const service = createTaskService(repo);
  const creating = service.add(input);
  const reloading = service.load();
  await creating; await reloading;
  assert.equal(service.getAll().length, 1);
});

test("coordinador: el último cambio de sesión manda sobre loading y errores", async () => {
  let emit;
  const events = [];
  const slow = controlledRepo();
  const service = createTaskService(createMemoryTaskRepository());
  const coordinator = createSessionCoordinator({
    auth: { onAuthChange: async (cb) => { emit = cb; return () => {}; } },
    taskService: service,
    createUserRepository: () => slow,
    createGuestRepository: () => createMemoryTaskRepository([T("demo")]),
    onUserChanged: (u) => events.push(`user:${u?.email ?? "-"}`),
    onLoadingChange: (v) => events.push(`loading:${v}`),
    onLoadError: (e) => events.push(`error:${e.message}`),
  });
  await coordinator.start();
  const a = emit({ uid: "ana", email: "ana" });
  const b = emit(null);
  await b;
  slow.pending.list.reject(new Error("tarde"));
  await a;
  assert.deepEqual(events, ["user:ana", "loading:true", "user:-", "loading:true", "loading:false"]);
  assert.deepEqual(service.getAll().map((t) => t.id), ["demo"]);
});

test("coordinador: error de la sesión vigente sí se informa", async () => {
  let emit; const events = [];
  const coordinator = createSessionCoordinator({
    auth: { onAuthChange: async (cb) => { emit = cb; } },
    taskService: createTaskService(createMemoryTaskRepository()),
    createUserRepository: () => ({ list: async () => { throw new Error("unavailable"); }, create() {}, update() {}, remove() {} }),
    createGuestRepository: () => createMemoryTaskRepository(),
    onUserChanged() {}, onLoadingChange: (v) => events.push(v), onLoadError: (e) => events.push(e.message),
  });
  await coordinator.start();
  await emit({ uid: "u", email: "u" });
  assert.deepEqual(events, [true, "unavailable", false]);
});

test("coordinador: start rechaza si la autenticación no está disponible", async () => {
  const coordinator = createSessionCoordinator({ auth: { onAuthChange: async () => { throw new Error("sin config"); } } });
  await assert.rejects(coordinator.start(), /sin config/);
});

function fakeClock() {
  const timers = new Map(); let n = 0;
  return { setInterval: (fn) => { timers.set(++n, fn); return n; }, clearInterval: (id) => timers.delete(id), tick: (s = 1) => { for (let i = 0; i < s; i++) [...timers.values()].forEach((f) => f()); }, count: () => timers.size };
}

test("pomodoro: ciclo completo con reloj inyectado", () => {
  const clock = fakeClock();
  const p = createPomodoroService({ clock });
  const states = []; p.onTick((s) => states.push(s));
  assert.deepEqual(states.at(-1), { mode: "work", remaining: 1500, running: false });
  p.start(); p.start(); assert.equal(clock.count(), 1, "doble start no crea dos temporizadores");
  clock.tick(1500);
  assert.deepEqual(states.at(-1), { mode: "break", remaining: 300, running: false });
  assert.equal(clock.count(), 0, "se detiene al cambiar de modo");
  p.start(); clock.tick(300);
  assert.deepEqual(states.at(-1), { mode: "work", remaining: 1500, running: false });
  p.start(); clock.tick(10); p.pause(); clock.tick(5);
  assert.deepEqual(states.at(-1), { mode: "work", remaining: 1490, running: false });
  p.reset(); assert.deepEqual(states.at(-1), { mode: "work", remaining: 1500, running: false });
});
