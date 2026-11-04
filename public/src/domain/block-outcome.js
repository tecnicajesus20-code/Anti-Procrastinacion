/**
 * RESULTADO DE UN BLOQUE ("¿Terminaste la tarea?"): se registra UNA sola vez por bloque.
 * Sin dependencias externas: no conoce el DOM, Firebase ni FullCalendar.
 *
 * El resultado vive dentro del bloque (block.outcome) y guarda los puntos ya calculados.
 * Los totales nunca se acumulan en un contador: se obtienen sumando los bloques, así que
 * recargar la página, repetir un clic o recibir el mismo evento dos veces no duplica puntos.
 *
 * @typedef {Object} BlockOutcome
 * @property {"completed"|"not_completed"} status
 * @property {number} points        Positivo si se completó, negativo (o 0) si no
 * @property {string} resolvedAt    ISO 8601
 * @property {"user"|"timeout"} source  "timeout": sin respuesta 24 h después del fin del bloque
 */
import { getDifficulty, pointsForBlock, penaltyForBlock } from "./difficulty.js";

export const BLOCK_OUTCOME = Object.freeze({ COMPLETED: "completed", NOT_COMPLETED: "not_completed" });
export const OUTCOME_SOURCE = Object.freeze({ USER: "user", TIMEOUT: "timeout" });

/** Tiempo que el aviso "¿Terminaste la tarea?" queda abierto antes de pasar a la campanita. */
export const END_PROMPT_WINDOW_MS = 3 * 60_000;
/** Sin respuesta durante este tiempo tras el fin del bloque → se registra como no realizado. */
export const UNANSWERED_TIMEOUT_MS = 24 * 60 * 60_000;

export const FOCUS_INTENT_MAX_LENGTH = 200;

/**
 * Construye el resultado de un bloque.
 * @param {{start: string, end: string, difficulty?: string}} block
 * @param {"completed"|"not_completed"} status
 * @param {{ now: Date, source?: "user"|"timeout" }} options
 * @returns {BlockOutcome}
 */
export function buildBlockOutcome(block, status, { now, source = OUTCOME_SOURCE.USER }) {
  if (!Object.values(BLOCK_OUTCOME).includes(status)) throw new RangeError("El resultado del bloque no es válido.");
  const points = status === BLOCK_OUTCOME.COMPLETED ? pointsForBlock(block) : -penaltyForBlock(block);
  return { status, points: points === 0 ? 0 : points, resolvedAt: now.toISOString(), source };
}

/** @returns {string|null} mensaje de error o null. Un bloque sin resultado es válido. */
export function validateBlockOutcome(outcome) {
  if (outcome === undefined || outcome === null) return null;
  if (
    typeof outcome !== "object"
    || !Object.values(BLOCK_OUTCOME).includes(outcome.status)
    || !Number.isInteger(outcome.points)
    || Number.isNaN(Date.parse(outcome.resolvedAt))
    || !Object.values(OUTCOME_SOURCE).includes(outcome.source)
  ) return "El resultado del bloque no es válido.";
  return null;
}

/** @returns {string|null} */
export function validateFocusIntent(intent) {
  if (intent === undefined || intent === null) return null;
  if (typeof intent !== "string" || !intent.trim()) return "La tarea concreta del bloque no puede estar vacía.";
  if (intent.length > FOCUS_INTENT_MAX_LENGTH) return `La tarea concreta del bloque admite hasta ${FOCUS_INTENT_MAX_LENGTH} caracteres.`;
  return null;
}

export const hasOutcome = (block) => Boolean(block?.outcome);

/** ¿La tarea usa el modelo por bloques (al menos un bloque con dificultad)? */
export const usesBlockScoring = (task) => getBlocks(task).some((block) => Boolean(getDifficulty(block.difficulty)));

/** La tarea queda completada solo cuando TODOS sus bloques están completados. */
export const allBlocksCompleted = (task) => getBlocks(task).every((block) => block.outcome?.status === BLOCK_OUTCOME.COMPLETED);

/**
 * ¿El bloque espera respuesta? (tiene dificultad, ya terminó y no tiene resultado)
 * Los bloques sin dificultad (tareas antiguas) nunca quedan pendientes.
 */
export function isAwaitingAnswer(block, nowMs) {
  return Boolean(getDifficulty(block?.difficulty)) && !hasOutcome(block) && Date.parse(block.end) <= nowMs;
}

function getBlocks(task) {
  return Array.isArray(task?.blocks) && task.blocks.length ? task.blocks : [{ start: task?.start, end: task?.end }];
}
