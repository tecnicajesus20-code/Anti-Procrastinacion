/**
 * BLOQUES DE TRABAJO: reparte el horario de una tarea en bloques cortos de enfoque con una pausa entre ellos.
 * Es un dato DERIVADO (se calcula cada vez a partir de start/end); no se guarda ni cambia el contrato de Task.
 * Sin dependencias: no conoce el DOM, Firebase ni FullCalendar.
 *
 * Ejemplo: tarea de 07:30 a 13:30, bloques de 25 min y pausa de 5 → 12 bloques (07:30–07:55, 08:00–08:25, …).
 *
 * @typedef {Object} WorkBlock
 * @property {number} number   Posición, empezando en 1
 * @property {string} start    ISO 8601
 * @property {string} end      ISO 8601
 * @property {number} minutes  Duración real del bloque
 */

const MS_PER_MINUTE = 60_000;

export const WORK_BLOCK_DEFAULTS = Object.freeze({ blockMinutes: 25, breakMinutes: 5, maxBlocks: 48 });

/** Duraciones que ofrece el selector del detalle de tarea (minutos). */
export const BLOCK_DURATION_OPTIONS = Object.freeze([15, 25, 45, 60]);

/**
 * @param {{start: string, end: string}} task
 * @param {{blockMinutes?: number, breakMinutes?: number, maxBlocks?: number}} [options]
 * @returns {{blocks: WorkBlock[], total: number}} `blocks` se limita a maxBlocks; `total` es la cantidad real.
 */
export function buildWorkBlocks(task, options = {}) {
  const { blockMinutes, breakMinutes, maxBlocks } = { ...WORK_BLOCK_DEFAULTS, ...options };
  const startMs = Date.parse(task?.start);
  const endMs = Date.parse(task?.end);
  if (!(blockMinutes > 0) || Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) return { blocks: [], total: 0 };

  const span = endMs - startMs;
  const blockMs = blockMinutes * MS_PER_MINUTE;
  const toBlock = (number, from, to) => ({
    number,
    start: new Date(from).toISOString(),
    end: new Date(to).toISOString(),
    minutes: Math.round((to - from) / MS_PER_MINUTE),
  });

  // Una tarea más corta que un bloque se queda como un único bloque con su duración real.
  if (span < blockMs) return { blocks: [toBlock(1, startMs, endMs)], total: 1 };

  const stepMs = (blockMinutes + Math.max(0, breakMinutes)) * MS_PER_MINUTE;
  const total = Math.floor((span - blockMs) / stepMs) + 1;
  const blocks = Array.from({ length: Math.min(total, maxBlocks) }, (_, index) => toBlock(index + 1, startMs + index * stepMs, startMs + index * stepMs + blockMs));
  return { blocks, total };
}