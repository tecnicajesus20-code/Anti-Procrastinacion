import { test } from "node:test";
import assert from "node:assert/strict";
import { taskToEvents } from "../../public/src/presentation/calendar/calendar.mapper.js";

test("cada bloque horario se convierte en un evento del calendario enlazado a la misma tarea", () => {
  const task = {
    id: "task-1",
    title: "Estudiar",
    status: "pending",
    start: "2026-11-02T09:00:00.000Z",
    end: "2026-11-02T10:00:00.000Z",
    blocks: [
      { start: "2026-11-02T09:00:00.000Z", end: "2026-11-02T10:00:00.000Z" },
      { start: "2026-11-03T09:00:00.000Z", end: "2026-11-03T10:00:00.000Z" },
    ],
  };

  const events = taskToEvents(task);
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

test("cada tarea recibe un color compartido por sus bloques y distinto del de otra tarea", () => {
  const task = {
    id: "task-2",
    title: "Informe",
    status: "pending",
    start: "2026-11-02T09:00:00.000Z",
    end: "2026-11-02T10:00:00.000Z",
    blocks: [
      { start: "2026-11-02T09:00:00.000Z", end: "2026-11-02T10:00:00.000Z" },
      { start: "2026-11-03T09:00:00.000Z", end: "2026-11-03T10:00:00.000Z" },
    ],
  };
  const colors = taskToEvents(task).map((event) => event.backgroundColor);
  const otherTask = { ...task, id: "task-1" };

  assert.equal(colors[0], colors[1]);
  assert.notEqual(colors[0], taskToEvents(otherTask)[0].backgroundColor);
});
