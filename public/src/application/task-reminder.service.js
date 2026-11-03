import { getTaskBlocks } from "../domain/task.js";

const CHECK_INTERVAL_MS = 10_000;
const MISSED_REMINDER_WINDOW_MS = 60_000;

/**
 * Notifies once when a scheduled block starts while the app is open.
 * @param {{
 *   taskService: ReturnType<import("./task.service.js").createTaskService>,
 *   onReminder: (reminder: {task: import("../domain/task.js").Task, blockIndex: number, block: {start: string, end: string}}) => void,
 *   clock?: { now: () => number, setInterval: (callback: () => void, ms: number) => unknown, clearInterval: (id: unknown) => void }
 * }} options
 */
export function createTaskReminderService({
  taskService,
  onReminder,
  clock = {
    now: () => Date.now(),
    setInterval: (callback, ms) => setInterval(callback, ms),
    clearInterval: (id) => clearInterval(id),
  },
}) {
  const notified = new Set();
  let intervalId = null;
  let lastCheck = null;
  let unsubscribe = null;

  function check() {
    const now = clock.now();
    const earliestStart = Math.max(
      lastCheck === null ? now - CHECK_INTERVAL_MS : lastCheck - 1000,
      now - MISSED_REMINDER_WINDOW_MS
    );

    taskService.getAll().forEach((task) => {
      if (task.status === "done") return;
      getTaskBlocks(task).forEach((block, blockIndex) => {
        const start = Date.parse(block.start);
        const key = `${task.id}:${block.start}:${block.end}`;
        if (start > earliestStart && start <= now && !notified.has(key)) {
          onReminder({ task, blockIndex, block });
          notified.add(key);
        }
      });
    });

    lastCheck = now;
  }

  function start() {
    if (intervalId !== null) return;
    check();
    unsubscribe = taskService.subscribe(check);
    intervalId = clock.setInterval(check, CHECK_INTERVAL_MS);
  }

  function stop() {
    if (intervalId === null) return;
    clock.clearInterval(intervalId);
    intervalId = null;
    unsubscribe?.();
    unsubscribe = null;
  }

  return { start, stop };
}
