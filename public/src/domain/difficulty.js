/**
 * DIFICULTAD POR BLOQUE: niveles, duración máxima de cada uno y puntos.
 * Sin dependencias: no conoce el DOM, Firebase ni FullCalendar.
 *
 * La dificultad es un dato de cada bloque (block.difficulty), no de la tarea.
 * Puntos de un bloque = multiplicador × (minutos / 15), redondeado y con mínimo 1.
 * Penalización por no completarlo = 20 % de esos puntos (redondeado, mínimo 1 si el bloque da puntos).
 * En el perfil: puntos ganados = "Impulsos", penalizaciones = "Desvíos", Score = Impulsos − Desvíos.
 * Los resultados ya guardados conservan los puntos con los que se registraron (block.outcome.points).
 */

const MS_PER_MINUTE = 60_000;

/** @typedef {"facil"|"moderada"|"intermedia"|"desafio"|"hardcore"} DifficultyId */

export const DIFFICULTIES = Object.freeze([
  Object.freeze({ id: "facil", label: "Fácil", icon: "🌱", maxMinutes: 30, multiplier: 1 }),
  Object.freeze({ id: "moderada", label: "Moderada", icon: "🚶", maxMinutes: 45, multiplier: 2 }),
  Object.freeze({ id: "intermedia", label: "Intermedia", icon: "🧠", maxMinutes: 60, multiplier: 3 }),
  Object.freeze({ id: "desafio", label: "Desafío", icon: "🔥", maxMinutes: 120, multiplier: 4 }),
  Object.freeze({ id: "hardcore", label: "Hardcore", icon: "💀", maxMinutes: null, multiplier: 5 }),
]);

/** Los Desvíos pesan mucho menos que los Impulsos: 20 % del valor del bloque. */
export const PENALTY_FACTOR = 0.2;

/** @param {string} id */
export const getDifficulty = (id) => DIFFICULTIES.find((difficulty) => difficulty.id === id) ?? null;

/** Duración del bloque en minutos (puede tener decimales); NaN si las fechas no son válidas. */
export function blockMinutes(block) {
  const start = Date.parse(block?.start);
  const end = Date.parse(block?.end);
  if (Number.isNaN(start) || Number.isNaN(end)) return Number.NaN;
  return (end - start) / MS_PER_MINUTE;
}

/** ¿El nivel admite un bloque de esta duración? Hardcore no tiene límite. */
export function isDifficultyAllowed(id, minutes) {
  const difficulty = getDifficulty(id);
  if (!difficulty || !Number.isFinite(minutes) || minutes <= 0) return false;
  return difficulty.maxMinutes === null || minutes <= difficulty.maxMinutes;
}

/** Niveles compatibles con la duración (los demás se muestran deshabilitados). */
export const allowedDifficulties = (minutes) => DIFFICULTIES.filter((difficulty) => isDifficultyAllowed(difficulty.id, minutes));

/**
 * Valida la dificultad de un bloque. Un bloque sin dificultad (tareas antiguas) es válido.
 * @returns {string|null} mensaje de error o null
 */
export function validateBlockDifficulty(block) {
  if (block?.difficulty === undefined || block.difficulty === null) return null;
  const difficulty = getDifficulty(block.difficulty);
  if (!difficulty) return "La dificultad del bloque no es válida.";
  const minutes = blockMinutes(block);
  // Una duración nula o negativa ya la informa validateTask ("La hora de fin debe ser posterior…").
  if (Number.isFinite(minutes) && minutes > 0 && !isDifficultyAllowed(difficulty.id, minutes)) {
    return `La dificultad ${difficulty.label} permite bloques de hasta ${difficulty.maxMinutes} minutos.`;
  }
  return null;
}

/** Puntos que otorga completar el bloque. 0 si el bloque no tiene dificultad (tareas antiguas). */
export function pointsForBlock(block) {
  const difficulty = getDifficulty(block?.difficulty);
  const minutes = blockMinutes(block);
  if (!difficulty || !Number.isFinite(minutes) || minutes <= 0) return 0;
  return Math.max(1, Math.round(difficulty.multiplier * (minutes / 15)));
}

/** Puntos que se descuentan si el bloque no se completa (valor positivo). */
export function penaltyForBlock(block) {
  const points = pointsForBlock(block);
  return points > 0 ? Math.max(1, Math.round(points * PENALTY_FACTOR)) : 0;
}
