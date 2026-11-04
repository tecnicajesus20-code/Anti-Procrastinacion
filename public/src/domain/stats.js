/**
 * ESTADÍSTICAS (solo cálculo; la pantalla se integrará después en Perfil).
 * Sin dependencias externas: no conoce el DOM, Firebase ni FullCalendar.
 *
 * Tiempo libre: se calcula a partir de los HUECOS entre bloques programados de un mismo día,
 * es decir, entre el inicio del primer bloque y el fin del último. Los días sin bloques no suman.
 * No se crean bloques de "Ocio": el tiempo libre es un dato derivado y no se guarda.
 * Los días son días locales del dispositivo (medianoche a medianoche).
 */
import { BLOCK_OUTCOME } from "./block-outcome.js";

const MS_PER_MINUTE = 60_000;

const blocksOf = (task) => (Array.isArray(task?.blocks) && task.blocks.length ? task.blocks : [{ start: task?.start, end: task?.end }]);

/**
 * Semana local que contiene `date` (lunes 00:00 → lunes siguiente 00:00 por defecto).
 * @param {Date} date
 * @param {number} [firstDay] 0 = domingo, 1 = lunes…
 * @returns {{from: Date, to: Date}}
 */
export function weekRange(date, firstDay = 1) {
  const from = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  from.setDate(from.getDate() - ((from.getDay() - firstDay + 7) % 7));
  const to = new Date(from);
  to.setDate(to.getDate() + 7);
  return { from, to };
}

/** Une intervalos [start, end) que se tocan o solapan. Entrada y salida en ms. */
function mergeIntervals(intervals) {
  const sorted = intervals.filter(([start, end]) => end > start).sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const [start, end] of sorted) {
    const last = merged[merged.length - 1];
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  return merged;
}

/** Todos los intervalos [start, end) de todas las tareas, en ms. */
function allIntervals(tasks) {
  return tasks.flatMap((task) => blocksOf(task).map((block) => [Date.parse(block.start), Date.parse(block.end)]))
    .filter(([start, end]) => Number.isFinite(start) && Number.isFinite(end) && end > start);
}

/**
 * Tiempo libre entre bloques, día por día.
 * @param {import("./task.js").Task[]} tasks
 * @param {{from: Date, to: Date}} range
 * @returns {{ totalMinutes: number, days: {date: string, scheduledMinutes: number, freeMinutes: number}[] }}
 *   `date` es la fecha local YYYY-MM-DD. Solo aparecen los días con al menos un bloque.
 */
export function freeTimeBetweenBlocks(tasks, { from, to }) {
  const intervals = allIntervals(tasks);
  const days = [];
  for (let day = new Date(from); day < to; day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)) {
    const dayStart = Math.max(day.getTime(), from.getTime());
    const next = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).getTime();
    const dayEnd = Math.min(next, to.getTime());
    const merged = mergeIntervals(intervals.map(([start, end]) => [Math.max(start, dayStart), Math.min(end, dayEnd)]));
    if (!merged.length) continue;
    const busy = merged.reduce((sum, [start, end]) => sum + (end - start), 0);
    const span = merged[merged.length - 1][1] - merged[0][0];
    days.push({
      date: `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`,
      scheduledMinutes: Math.round(busy / MS_PER_MINUTE),
      freeMinutes: Math.round((span - busy) / MS_PER_MINUTE),
    });
  }
  return { totalMinutes: days.reduce((sum, day) => sum + day.freeMinutes, 0), days };
}

/** Texto para el usuario: "Te sobran 5 horas esta semana" (redondeado a medias horas). */
export function describeFreeTime(totalMinutes, period = "esta semana") {
  const hours = Math.round((totalMinutes / 60) * 2) / 2;
  if (hours <= 0) return `No te sobra tiempo entre tus bloques ${period}`;
  const value = Number.isInteger(hours) ? String(hours) : String(hours).replace(".", ",");
  return `Te sobra${hours === 1 ? "" : "n"} ${value} ${hours === 1 ? "hora" : "horas"} ${period}`;
}

/** Inicio del bloque dentro del rango [from, to). */
const inRange = (block, from, to) => {
  const start = Date.parse(block.start);
  return start >= from.getTime() && start < to.getTime();
};

/**
 * Minutos programados por categoría (según el inicio de cada bloque).
 * Las tareas sin categoría se agrupan bajo "sin_categoria".
 * @returns {Record<string, number>}
 */
export function minutesByCategory(tasks, { from, to }) {
  const totals = {};
  for (const task of tasks) {
    const key = task.category || "sin_categoria";
    for (const block of blocksOf(task)) {
      if (!inRange(block, from, to)) continue;
      const minutes = (Date.parse(block.end) - Date.parse(block.start)) / MS_PER_MINUTE;
      if (Number.isFinite(minutes) && minutes > 0) totals[key] = (totals[key] ?? 0) + minutes;
    }
  }
  return Object.fromEntries(Object.entries(totals).map(([key, minutes]) => [key, Math.round(minutes)]));
}

/**
 * Resumen de puntos a partir de los resultados guardados en cada bloque.
 * @param {{from: Date, to: Date}} [range] si se omite, todo el historial
 */
export function pointsSummary(tasks, range) {
  const summary = { earned: 0, lost: 0, net: 0, completedBlocks: 0, failedBlocks: 0 };
  for (const task of tasks) {
    for (const block of blocksOf(task)) {
      const outcome = block.outcome;
      if (!outcome || !Number.isInteger(outcome.points)) continue;
      if (range && !inRange(block, range.from, range.to)) continue;
      if (outcome.status === BLOCK_OUTCOME.COMPLETED) {
        summary.earned += outcome.points;
        summary.completedBlocks += 1;
      } else {
        summary.lost += Math.abs(outcome.points);
        summary.failedBlocks += 1;
      }
    }
  }
  summary.net = summary.earned - summary.lost;
  return summary;
}
