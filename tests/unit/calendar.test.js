import { test } from "node:test";
import assert from "node:assert/strict";
import { taskToEvents } from "../../public/src/presentation/calendar/calendar.mapper.js";

test("cada bloque horario se convierte en un evento del calendario enlazado a la misma tarea", () => {
  const task = {
    id: "task-1",
    title: "Estudiar",
    status: "pending",
    start: "2026-11-02T09:00:00.000Z",
    end: "2026-11-02T09:20:00.000Z",
    blocks: [
      { start: "2026-11-02T09:00:00.000Z", end: "2026-11-02T09:20:00.000Z" },
      { start: "2026-11-03T09:00:00.000Z", end: "2026-11-03T09:20:00.000Z" },
    ],
  };

  const events = taskToEvents(task).filter((event) => event.extendedProps.kind === "task");
  assert.deepEqual(events.map((event) => ({
    id: event.id,
    start: event.start,
    backgroundColor: event.backgroundColor,
    borderColor: event.borderColor,
    taskId: event.extendedProps.taskId,
    blockIndex: event.extendedProps.blockIndex,
  })), [
    { id: "task-1:block:0", start: task.blocks[0].start, backgroundColor: events[0].backgroundColor, borderColor: events[0].borderColor, taskId: "task-1", blockIndex: 0 },
    { id: "task-1:block:1", start: task.blocks[1].start, backgroundColor: events[0].backgroundColor, borderColor: events[0].borderColor, taskId: "task-1", blockIndex: 1 },
  ]);
});

test("el calendario muestra enfoque y descansos calculados para cada bloque de tarea", () => {
  const task = {
    id: "task-pomodoro",
    title: "Preparar entrega",
    status: "pending",
    start: "2026-11-02T09:00:00.000Z",
    end: "2026-11-02T10:00:00.000Z",
  };
  const events = taskToEvents(task).filter((event) => event.extendedProps.kind.startsWith("pomodoro-"));

  assert.deepEqual(events.map((event) => [event.extendedProps.kind, event.start, event.end]), [
    ["pomodoro-focus", "2026-11-02T09:00:00.000Z", "2026-11-02T09:30:00.000Z"],
    ["pomodoro-focus", "2026-11-02T09:30:00.000Z", "2026-11-02T10:00:00.000Z"],
  ]);
  assert.equal(taskToEvents(task).some((event) => event.extendedProps.kind === "task"), false);
  assert.deepEqual(events.map((event) => event.title), ["Enfoque · 25 min", "Enfoque · 25 min"]);
  assert.deepEqual(events.map((event) => [event.extendedProps.focusEnd, event.extendedProps.breakStart, event.extendedProps.breakEnd]), [
    ["2026-11-02T09:25:00.000Z", "2026-11-02T09:25:00.000Z", "2026-11-02T09:30:00.000Z"],
    ["2026-11-02T09:55:00.000Z", "2026-11-02T09:55:00.000Z", "2026-11-02T10:00:00.000Z"],
  ]);
  assert.ok(events.every((event) => event.classNames.includes("event--pomodoro-cycle-with-break")));
  assert.ok(events.every((event) => event.editable === false));
});

test("el calendario muestra los minutos residuales y vuelve a calcularse al editar el bloque", () => {
  const task = {
    id: "task-residual",
    title: "Leer",
    status: "pending",
    start: "2026-11-02T09:00:00.000Z",
    end: "2026-11-02T09:45:00.000Z",
  };
  const events = taskToEvents(task).filter((event) => event.extendedProps.kind === "pomodoro-focus");
  assert.deepEqual(events.map((event) => [event.title, event.start, event.end]), [
    ["Enfoque · 25 min", "2026-11-02T09:00:00.000Z", "2026-11-02T09:30:00.000Z"],
    ["Enfoque · 15 min", "2026-11-02T09:30:00.000Z", "2026-11-02T09:45:00.000Z"],
  ]);

  const extendedEvents = taskToEvents({ ...task, end: "2026-11-02T10:00:00.000Z" })
    .filter((event) => event.extendedProps.kind === "pomodoro-focus");
  assert.equal(extendedEvents.length, 2);
  assert.equal(new Set(extendedEvents.map((event) => event.id)).size, 2);
  assert.equal(extendedEvents[1].end, "2026-11-02T10:00:00.000Z");
});

test("cada tarea recibe un color compartido por sus bloques y distinto del de otra tarea", () => {
  const task = {
    id: "task-2",
    title: "Informe",
    status: "pending",
    start: "2026-11-02T09:00:00.000Z",
    end: "2026-11-02T09:20:00.000Z",
    blocks: [
      { start: "2026-11-02T09:00:00.000Z", end: "2026-11-02T09:20:00.000Z" },
      { start: "2026-11-03T09:00:00.000Z", end: "2026-11-03T09:20:00.000Z" },
    ],
  };
  const colors = taskToEvents(task)
    .filter((event) => event.extendedProps.kind === "task")
    .map((event) => event.backgroundColor);
  const otherTask = { ...task, id: "task-1" };

  assert.equal(colors[0], colors[1]);
  assert.notEqual(
    colors[0],
    taskToEvents(otherTask).find((event) => event.extendedProps.kind === "task").backgroundColor
  );
});
