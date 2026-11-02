import { test } from "node:test";
import assert from "node:assert/strict";
import { createTaskReminderService } from "../../public/src/application/task-reminder.service.js";

function createFakeClock(now) {
  const callbacks = new Map();
  let nextId = 0;
  return {
    callbacks,
    setNow(value) { now = value; },
    now: () => now,
    setInterval(callback) {
      const id = ++nextId;
      callbacks.set(id, callback);
      return id;
    },
    clearInterval(id) { callbacks.delete(id); },
    tick() { [...callbacks.values()].forEach((callback) => callback()); },
  };
}

test("task reminders fire once when each block starts and stop cleanly", () => {
  const startsAt = Date.parse("2026-11-02T09:00:00.000Z");
  const clock = createFakeClock(startsAt - 5_000);
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
  const listeners = new Set();
  const reminders = [];
  const taskService = {
    getAll: () => [task],
    subscribe(callback) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
  };
  const service = createTaskReminderService({
    taskService,
    onReminder: (reminder) => reminders.push(reminder),
    clock,
  });

  service.start();
  assert.equal(reminders.length, 0);
  clock.setNow(startsAt);
  clock.tick();
  clock.tick();
  assert.equal(reminders.length, 1);
  assert.equal(reminders[0].task.title, "Estudiar");
  assert.equal(reminders[0].blockIndex, 0);

  service.stop();
  assert.equal(clock.callbacks.size, 0);
  assert.equal(listeners.size, 0);
});
