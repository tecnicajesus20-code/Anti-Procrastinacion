/**
 * PROGRESO DEL USUARIO (perfil): Score, historial de puntos y estadísticas de uso del tiempo.
 * Sin dependencias externas: no conoce el DOM, Firebase ni FullCalendar. Todo se DERIVA de las tareas.
 *
 * Fuente de verdad de los puntos: block.outcome (ver domain/block-outcome.js). Cada bloque tiene como
 * mucho UN resultado, así que sumar los resultados nunca cuenta dos veces el mismo bloque.
 *   Impulsos = suma de outcome.points de los bloques completados
 *   Desvíos  = suma de |outcome.points| de los bloques no completados
 *   Score    = Impulsos − Desvíos
 *
 * Qué cuenta como "bloque completado" (nunca se supone):
 *   - Bloque con dificultad: solo si su resultado es "completed" (respuesta del usuario).
 *   - Bloque sin dificultad (tareas anteriores a la puntuación): si la tarea está marcada como
 *     terminada y el bloque ya pasó. Es la única confirmación que existía antes.
 *
 * Tiempo enfocado de un bloque:
 *   - Si tiene sesiones Pomodoro completadas dentro de su horario → suma de su duración real.
 *   - Si no, y el bloque está completado → la duración del bloque.
 *   - En otro caso → 0. Lo programado nunca se cuenta como enfocado.
 *
 * Las semanas son locales y empiezan el lunes; un bloque pertenece al periodo en que EMPIEZA
 * (igual que stats.js).
 */
import { BLOCK_OUTCOME } from "./block-outcome.js";
import { resolveTaskCategory } from "./category.js";
import { weekRange, freeTimeBetweenBlocks, pointsSummary } from "./stats.js";

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 24 * 60 * MS_PER_MINUTE;

/** Grupo para las tareas sin categoría (tareas antiguas). */
export const UNCATEGORIZED = Object.freeze({ id: "sin_categoria", name: "Sin categoría", color: "#94a3b0", icon: "▫️", base: true });

export const MOVEMENT_TYPE = Object.freeze({ IMPULSE: "impulso", DEVIATION: "desvio" });

const blocksOf = (task) => (Array.isArray(task?.blocks) && task.blocks.length ? task.blocks : [{ start: task?.start, end: task?.end }]);
const categoryOf = (task, categories) => resolveTaskCategory(task, categories) ?? UNCATEGORIZED;

/** Sesiones Pomodoro completadas cuyo inicio programado cae dentro del bloque. */
function completedSessionsIn(task, startMs, endMs) {
  return (Array.isArray(task.pomodoroSessions) ? task.pomodoroSessions : []).filter((session) => {
    const at = Date.parse(session?.scheduledStart);
    return session?.status === "completed" && at >= startMs && at < endMs;
  });
}

/**
 * ¿El bloque está completado? (ver reglas arriba)
 * @param {number} nowMs
 */
export function isBlockCompleted(task, block, nowMs) {
  if (block?.outcome) return block.outcome.status === BLOCK_OUTCOME.COMPLETED;
  if (block?.difficulty) return false; // bloque puntuable sin respuesta todavía
  return task?.status === "done" && Date.parse(block?.end) <= nowMs;
}

/**
 * Un registro por bloque válido de todas las tareas, con lo necesario para las estadísticas.
 * @returns {{task: Object, block: Object, index: number, startMs: number, endMs: number, minutes: number,
 *   completed: boolean, failed: boolean, focusMinutes: number, measuredByPomodoro: boolean}[]}
 */
export function blockRecords(tasks, nowMs) {
  const records = [];
  for (const task of tasks ?? []) {
    blocksOf(task).forEach((block, index) => {
      const startMs = Date.parse(block?.start);
      const endMs = Date.parse(block?.end);
      if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return;
      const minutes = (endMs - startMs) / MS_PER_MINUTE;
      const completed = isBlockCompleted(task, block, nowMs);
      const sessions = completedSessionsIn(task, startMs, endMs);
      const pomodoroMinutes = sessions.reduce((sum, session) => {
        const actual = Number(session.actualDurationSeconds) || 0;
        const planned = Number(session.plannedDurationSeconds) || actual;
        return sum + Math.max(0, Math.min(actual, planned)) / 60;
      }, 0);
      records.push({
        task,
        block,
        index,
        startMs,
        endMs,
        minutes,
        completed,
        failed: block?.outcome?.status === BLOCK_OUTCOME.NOT_COMPLETED,
        focusMinutes: sessions.length ? Math.min(pomodoroMinutes, minutes) : (completed ? minutes : 0),
        measuredByPomodoro: sessions.length > 0,
      });
    });
  }
  return records;
}

const inRange = (record, { from, to }) => record.startMs >= from.getTime() && record.startMs < to.getTime();

/* ------------------------------------------------------------------ SCORE E HISTORIAL */

/**
 * Impulsos, Desvíos y Score (reutiliza pointsSummary de stats.js; no hay otro cálculo de puntos).
 * @param {{from: Date, to: Date}} [range]
 */
export function scoreSummary(tasks, range) {
  const { earned, lost, net, completedBlocks, failedBlocks } = pointsSummary(tasks, range);
  return { impulses: earned, deviations: lost, score: net, completedBlocks, failedBlocks };
}

/**
 * Movimientos de puntos, del más reciente al más antiguo. Uno por bloque con resultado.
 * @returns {{id: string, type: "impulso"|"desvio", points: number, taskId: string, taskTitle: string,
 *   category: Object, blockIndex: number, blockStart: string, blockEnd: string, resolvedAt: string,
 *   source: "user"|"timeout"}[]}
 */
export function pointsHistory(tasks, categories = []) {
  const movements = [];
  for (const task of tasks ?? []) {
    blocksOf(task).forEach((block, index) => {
      const outcome = block?.outcome;
      if (!outcome || !Number.isInteger(outcome.points)) return;
      const impulse = outcome.status === BLOCK_OUTCOME.COMPLETED;
      movements.push({
        id: `${task.id}:${block.start}`,
        type: impulse ? MOVEMENT_TYPE.IMPULSE : MOVEMENT_TYPE.DEVIATION,
        points: Math.abs(outcome.points),
        taskId: task.id,
        taskTitle: task.title,
        category: categoryOf(task, categories),
        blockIndex: index,
        blockStart: block.start,
        blockEnd: block.end,
        resolvedAt: outcome.resolvedAt,
        source: outcome.source,
      });
    });
  }
  return movements.sort((a, b) => Date.parse(b.resolvedAt) - Date.parse(a.resolvedAt));
}

/* ------------------------------------------------------------------ DISTRIBUCIÓN POR CATEGORÍA */

/**
 * Tiempo de los bloques COMPLETADOS por categoría (no se usa el número de tareas).
 * @param {{nowMs: number, range?: {from: Date, to: Date}}} options
 * @returns {{ totalMinutes: number, items: {category: Object, minutes: number, share: number}[], top: Object|null }}
 *   items ordenados de mayor a menor; share entre 0 y 1.
 */
export function timeByCategory(tasks, categories, { nowMs, range } = {}) {
  const totals = new Map();
  for (const record of blockRecords(tasks, nowMs)) {
    if (!record.completed || (range && !inRange(record, range))) continue;
    const category = categoryOf(record.task, categories);
    const entry = totals.get(category.id) ?? { category, minutes: 0 };
    entry.minutes += record.minutes;
    totals.set(category.id, entry);
  }
  const totalMinutes = [...totals.values()].reduce((sum, entry) => sum + entry.minutes, 0);
  const items = [...totals.values()]
    .map((entry) => ({ ...entry, minutes: Math.round(entry.minutes), share: totalMinutes ? entry.minutes / totalMinutes : 0 }))
    .sort((a, b) => b.minutes - a.minutes || a.category.name.localeCompare(b.category.name, "es"));
  return { totalMinutes: Math.round(totalMinutes), items, top: items[0] ?? null };
}

/* ------------------------------------------------------------------ PRODUCTIVIDAD */

function periodTotals(records, range) {
  const totals = { focusMinutes: 0, scheduledMinutes: 0, completedMinutes: 0 };
  for (const record of records) {
    if (!inRange(record, range)) continue;
    totals.scheduledMinutes += record.minutes;
    totals.focusMinutes += record.focusMinutes;
    if (record.completed) totals.completedMinutes += record.minutes;
  }
  return Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, Math.round(value)]));
}

/**
 * Horas enfocadas, semana actual frente a la anterior y promedio diario.
 * @param {Date} now
 * @returns {{ totalFocusMinutes: number, thisWeek: Object, lastWeek: Object, changePct: number|null,
 *   dailyAverageMinutes: number, daysElapsed: number, pomodoroMeasuredBlocks: number }}
 *   changePct es null cuando la semana anterior no tiene tiempo enfocado (no se puede comparar).
 */
export function productivitySummary(tasks, now) {
  const nowMs = now.getTime();
  const records = blockRecords(tasks, nowMs);
  const current = weekRange(now);
  const previous = { from: new Date(current.from), to: new Date(current.from) };
  previous.from.setDate(previous.from.getDate() - 7);
  const thisWeek = periodTotals(records, current);
  const lastWeek = periodTotals(records, previous);
  // Días transcurridos de la semana actual, incluido hoy (1 = lunes … 7 = domingo).
  const daysElapsed = Math.min(7, Math.max(1, Math.floor((nowMs - current.from.getTime()) / MS_PER_DAY) + 1));
  return {
    totalFocusMinutes: Math.round(records.reduce((sum, record) => sum + record.focusMinutes, 0)),
    thisWeek,
    lastWeek,
    changePct: lastWeek.focusMinutes > 0
      ? Math.round(((thisWeek.focusMinutes - lastWeek.focusMinutes) / lastWeek.focusMinutes) * 100)
      : null,
    dailyAverageMinutes: Math.round(thisWeek.focusMinutes / daysElapsed),
    daysElapsed,
    pomodoroMeasuredBlocks: records.filter((record) => record.measuredByPomodoro).length,
  };
}

/* ------------------------------------------------------------------ HORARIOS PRODUCTIVOS */

/**
 * Cumplimiento por hora de inicio del bloque (hora local). Mide bloques COMPLETADOS, no tiempo programado.
 * La mejor franja es la de más bloques completados; empate → mayor tasa de cumplimiento → más temprano.
 * @returns {{ hours: {hour: number, completed: number, failed: number, rate: number|null}[],
 *   best: {hour: number, completed: number, rate: number|null, category: Object|null}|null }}
 */
export function productiveHours(tasks, categories, nowMs) {
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, completed: 0, failed: 0, minutesByCategory: new Map() }));
  for (const record of blockRecords(tasks, nowMs)) {
    const slot = hours[new Date(record.startMs).getHours()];
    if (record.completed) {
      slot.completed += 1;
      const category = categoryOf(record.task, categories);
      const entry = slot.minutesByCategory.get(category.id) ?? { category, minutes: 0 };
      entry.minutes += record.minutes;
      slot.minutesByCategory.set(category.id, entry);
    } else if (record.failed) {
      slot.failed += 1;
    }
  }
  const rateOf = (slot) => (slot.completed + slot.failed ? slot.completed / (slot.completed + slot.failed) : null);
  const ranked = hours.filter((slot) => slot.completed > 0)
    .sort((a, b) => b.completed - a.completed || (rateOf(b) ?? 0) - (rateOf(a) ?? 0) || a.hour - b.hour);
  const bestSlot = ranked[0];
  const topCategory = bestSlot
    ? [...bestSlot.minutesByCategory.values()].sort((a, b) => b.minutes - a.minutes)[0]?.category ?? null
    : null;
  return {
    hours: hours.map((slot) => ({ hour: slot.hour, completed: slot.completed, failed: slot.failed, rate: rateOf(slot) })),
    best: bestSlot ? { hour: bestSlot.hour, completed: bestSlot.completed, rate: rateOf(bestSlot), category: topCategory } : null,
  };
}

/* ------------------------------------------------------------------ TIEMPO LIBRE */

/**
 * Tiempo libre ENTRE los bloques de Muven en la semana actual (reutiliza freeTimeBetweenBlocks).
 * No es la disponibilidad real del usuario: solo los huecos entre lo que tiene en el calendario.
 * Hacen falta al menos 2 bloques en la semana para que haya huecos que medir.
 */
export function weeklyFreeTime(tasks, now) {
  const range = weekRange(now);
  const blocksInWeek = blockRecords(tasks, now.getTime()).filter((record) => inRange(record, range)).length;
  const result = freeTimeBetweenBlocks(tasks, range);
  return { ...result, range, blocksInWeek, enoughData: blocksInWeek >= 2 };
}

/* ------------------------------------------------------------------ EVOLUCIÓN SEMANAL */

/**
 * Las últimas `weeks` semanas (la última es la actual), de la más antigua a la más reciente.
 * score es el Score ACUMULADO al final de cada semana (incluye todo lo anterior).
 * @returns {{from: Date, to: Date, focusMinutes: number, completed: number, failed: number, score: number}[]}
 */
export function weeklyEvolution(tasks, now, weeks = 8) {
  const records = blockRecords(tasks, now.getTime());
  const current = weekRange(now);
  const result = [];
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const from = new Date(current.from);
    from.setDate(from.getDate() - 7 * i);
    const to = new Date(from);
    to.setDate(to.getDate() + 7);
    const range = { from, to };
    const inWeek = records.filter((record) => inRange(record, range));
    result.push({
      from,
      to,
      focusMinutes: Math.round(inWeek.reduce((sum, record) => sum + record.focusMinutes, 0)),
      completed: inWeek.filter((record) => record.completed).length,
      failed: inWeek.filter((record) => record.failed).length,
      score: pointsSummary(tasks, { from: new Date(0), to }).net,
    });
  }
  return result;
}
