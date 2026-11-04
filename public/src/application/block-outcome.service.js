/**
 * CASOS DE USO DEL BLOQUE: intención al iniciarlo y resultado al terminarlo ("¿Terminaste la tarea?").
 * No toca el DOM ni conoce Firebase: guarda todo a través de taskService (dentro de task.blocks[i]).
 *
 * API pública:
 *   defineIntent(taskId, block, text)   Guarda la tarea concreta del bloque
 *   complete(taskId, block)             Botón "Completar" del bloque (suma puntos)
 *   answer(taskId, block, done)         Respuesta Sí/No al aviso o desde la campanita
 *   expire(taskId, block)               Sin respuesta 24 h después del fin → no realizado
 *   `block` puede ser el índice o el propio bloque {start, end} (más seguro si la lista cambió).
 *
 * Garantías contra puntos duplicados:
 *   - Un bloque con resultado ya no acepta otro (se rechaza).
 *   - Dos peticiones simultáneas del mismo bloque en esta pestaña: la segunda se rechaza.
 *   - Los puntos se guardan en el bloque y los totales se SUMAN al leer: no hay contadores que incrementar.
 * La tarea pasa a "done" en la misma escritura cuando todos sus bloques quedan completados.
 */
import { getTaskBlocks, TASK_STATUS } from "../domain/task.js";
import {
  BLOCK_OUTCOME, OUTCOME_SOURCE, buildBlockOutcome, allBlocksCompleted, validateFocusIntent,
} from "../domain/block-outcome.js";

/**
 * @param {{
 *   taskService: ReturnType<import("./task.service.js").createTaskService>,
 *   now?: () => Date
 * }} deps
 */
export function createBlockOutcomeService({ taskService, now = () => new Date() }) {
  if (!taskService) throw new TypeError("Se requiere taskService.");
  const inFlight = new Set();

  function locate(taskId, blockRef) {
    const task = taskService.getAll().find((candidate) => candidate.id === taskId);
    if (!task) throw new Error("No se encontró la tarea del bloque.");
    const blocks = getTaskBlocks(task);
    const index = Number.isInteger(blockRef)
      ? blockRef
      : blocks.findIndex((block) => block.start === blockRef?.start && block.end === blockRef?.end);
    if (index < 0 || index >= blocks.length) throw new Error("No se encontró el bloque (puede que haya cambiado de horario).");
    return { task, blocks, index, block: blocks[index] };
  }

  async function resolve(taskId, blockRef, status, source) {
    const { task, blocks, index, block } = locate(taskId, blockRef);
    if (block.outcome) throw new Error("Este bloque ya tiene un resultado registrado.");
    const key = `${taskId}:${block.start}:${block.end}`;
    if (inFlight.has(key)) throw new Error("Ya se está registrando el resultado de este bloque.");

    const timestamp = now();
    if (Date.parse(block.start) > timestamp.getTime()) throw new Error("El bloque todavía no ha empezado.");
    if (status === BLOCK_OUTCOME.NOT_COMPLETED && Date.parse(block.end) > timestamp.getTime()) {
      throw new Error("El bloque todavía no ha terminado.");
    }

    inFlight.add(key);
    try {
      blocks[index] = { ...block, outcome: buildBlockOutcome(block, status, { now: timestamp, source }) };
      const changes = { blocks };
      if (allBlocksCompleted({ ...task, blocks }) && task.status !== TASK_STATUS.DONE) changes.status = TASK_STATUS.DONE;
      return await taskService.update(taskId, changes);
    } finally {
      inFlight.delete(key);
    }
  }

  async function defineIntent(taskId, blockRef, text) {
    const intent = String(text ?? "").trim();
    const error = validateFocusIntent(intent);
    if (error) throw new Error(error);
    const { index, block } = locate(taskId, blockRef);
    return taskService.updateBlock(taskId, index, { start: block.start, end: block.end }, { focusIntent: intent });
  }

  return {
    defineIntent,
    complete: (taskId, blockRef) => resolve(taskId, blockRef, BLOCK_OUTCOME.COMPLETED, OUTCOME_SOURCE.USER),
    answer: (taskId, blockRef, done) => resolve(
      taskId, blockRef, done ? BLOCK_OUTCOME.COMPLETED : BLOCK_OUTCOME.NOT_COMPLETED, OUTCOME_SOURCE.USER
    ),
    expire: (taskId, blockRef) => resolve(taskId, blockRef, BLOCK_OUTCOME.NOT_COMPLETED, OUTCOME_SOURCE.TIMEOUT),
  };
}
