import { test } from "node:test";
import assert from "node:assert/strict";
import { eventToBlock, taskToEvents } from "../../public/src/presentation/calendar/calendar.mapper.js";

test("cada bloque horario se representa como una sola tarea editable", () => {
  const task = {
    id: "task-1",
    title: "Estudiar",
    status: "pending",
    start: "2026-11-02T09:00:00.000Z",
    end: "2026-11-02T11:00:00.000Z",
    blocks: [
      { start: "2026-11-02T09:00:00.000Z", end: "2026-11-02T11:00:00.000Z" },
      { start: "2026-11-03T09:00:00.000Z", end: "2026-11-03T09:20:00.000Z" },
    ],
    pomodoroSessions: [{ id: "old-session", scheduleKey: "0:old", status: "unfulfilled" }],
  };

  const events = taskToEvents(task);
  assert.equal(events.length, 2);
  assert.deepEqual(events.map((event) => ({
    id: event.id,
    title: event.title,
    start: event.start,
    end: event.end,
    taskId: event.extendedProps.taskId,
    blockIndex: event.extendedProps.blockIndex,
    kind: event.extendedProps.kind,
    editable: event.editable,
  })), [
    {
      id: "task-1:block:0",
      title: task.title,
      start: task.blocks[0].start,
      end: task.blocks[0].end,
      taskId: task.id,
      blockIndex: 0,
      kind: "task",
      editable: true,
    },
    {
      id: "task-1:block:1",
      title: task.title,
      start: task.blocks[1].start,
      end: task.blocks[1].end,
      taskId: task.id,
      blockIndex: 1,
      kind: "task",
      editable: true,
    },
  ]);
  assert.ok(events.every((event) => event.classNames.includes("event--calendar-task")));
});

test("mover y redimensionar una tarea conserva su bloque en ISO", () => {
  const start = new Date("2026-11-02T09:00:00.000Z");
  const oldEvent = { start, end: new Date("2026-11-02T10:00:00.000Z") };
  const event = { start, end: new Date("2026-11-02T09:45:00.000Z") };

  assert.deepEqual(eventToBlock(event, oldEvent), {
    start: "2026-11-02T09:00:00.000Z",
    end: "2026-11-02T09:45:00.000Z",
  });
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
  const colors = taskToEvents(task).map((event) => event.backgroundColor);

  assert.equal(colors[0], colors[1]);
  assert.notEqual(colors[0], taskToEvents({ ...task, id: "task-1" })[0].backgroundColor);
});
