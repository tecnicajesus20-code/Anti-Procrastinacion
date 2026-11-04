/**
 * VIGILA EL FIN DE LOS BLOQUES con dificultad mientras la app está abierta.
 * No toca el DOM: comunica todo mediante callbacks. Mismo patrón que task-reminder.service.js.
 *
 *   fin del bloque ─▶ onPrompt (aviso "¿Terminaste la tarea?", abierto 3 minutos)
 *   sin respuesta  ─▶ el bloque queda en onPendingChange (campanita) SIN tocar puntos
 *   24 h después del fin sin respuesta ─▶ blockOutcomes.expire → no realizado (penalización)
 *
 * Los bloques sin dificultad (tareas antiguas) se ignoran: nunca piden respuesta ni penalizan.
 * El aviso solo se abre si el bloque terminó hace menos de 3 minutos; si la app se abre más tarde,
 * el bloque aparece directamente en la campanita.
 */
import { getTaskBlocks } from "../domain/task.js";
import { isAwaitingAnswer, END_PROMPT_WINDOW_MS, UNANSWERED_TIMEOUT_MS } from "../domain/block-outcome.js";

const CHECK_INTERVAL_MS = 10_000;

/**
 * @typedef {{task: import("../domain/task.js").Task, blockIndex: number, block: {start: string, end: string}, key: string, expiresAt: number}} PendingBlock
 * @param {{
 *   taskService: ReturnType<import("./task.service.js").createTaskService>,
 *   blockOutcomes: ReturnType<import("./block-outcome.service.js").createBlockOutcomeService>,
 *   onPrompt: (prompt: PendingBlock & { closesAt: number }) => void,
 *   onPendingChange: (pending: PendingBlock[]) => void,
 *   onError: (error: Error) => void,
 *   clock?: { now: () => number, setInterval: (cb: () => void, ms: number) => unknown, clearInterval: (id: unknown) => void }
 * }} options
 */
export function createBlockEndWatcher({
  taskService,
  blockOutcomes,
  onPrompt,
  onPendingChange,
  onError,
  clock = {
    now: () => Date.now(),
    setInterval: (callback, ms) => setInterval(callback, ms),
    clearInterval: (id) => clearInterval(id),
  },
}) {
  const prompted = new Set();
  const expiring = new Set();
  const reportedFailures = new Set();
  let intervalId = null;
  let unsubscribe = null;

  function expire(task, block, key) {
    expiring.add(key);
    blockOutcomes.expire(task.id, { start: block.start, end: block.end })
      .catch((error) => {
        expiring.delete(key); // se reintenta en la siguiente comprobación
        if (!reportedFailures.has(key)) {
          reportedFailures.add(key);
          onError(error);
        }
      });
  }

  function check() {
    const nowMs = clock.now();
    const pending = [];
    taskService.getAll().forEach((task) => {
      getTaskBlocks(task).forEach((block, blockIndex) => {
        if (!isAwaitingAnswer(block, nowMs)) return;
        const key = `${task.id}:${block.start}:${block.end}`;
        const endMs = Date.parse(block.end);
        if (nowMs - endMs >= UNANSWERED_TIMEOUT_MS) {
          if (!expiring.has(key)) expire(task, block, key);
          return;
        }
        const item = { task, blockIndex, block, key, expiresAt: endMs + UNANSWERED_TIMEOUT_MS };
        pending.push(item);
        if (nowMs - endMs < END_PROMPT_WINDOW_MS && !prompted.has(key)) {
          prompted.add(key);
          onPrompt({ ...item, closesAt: endMs + END_PROMPT_WINDOW_MS });
        }
      });
    });
    pending.sort((a, b) => Date.parse(a.block.end) - Date.parse(b.block.end));
    onPendingChange(pending);
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

  return { start, stop, check };
}
