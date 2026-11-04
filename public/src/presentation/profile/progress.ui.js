/**
 * PERFIL · PROGRESO: Score, historial de movimientos y dashboard de estadísticas.
 * Solo presentación: todos los números salen de domain/progress.js (y este reutiliza stats.js).
 * Se redibuja cuando cambian las tareas o las categorías, y al abrir la pestaña Perfil.
 */
import { byId } from "../../shared/dom.js";
import {
  scoreSummary, pointsHistory, timeByCategory, productivitySummary, productiveHours, weeklyFreeTime, weeklyEvolution,
  MOVEMENT_TYPE,
} from "../../domain/progress.js";
import { describeFreeTime } from "../../domain/stats.js";
import { doughnutChart, barChart, lineChart, dataTable, enableTooltips } from "./charts.js";

const HISTORY_PAGE = 10;
const MAX_SLICES = 7; // más categorías se agrupan en "Otras" (nunca se generan colores nuevos)
const OTHER_COLOR = "#9aa5b1";

/* ------------------------------------------------------------------ FORMATO */

const formatNumber = (value) => Math.round(value).toLocaleString("es");
function formatDuration(minutes) {
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}
const formatHours = (minutes) => `${(Math.round((minutes / 60) * 10) / 10).toLocaleString("es")} h`;
const formatPercent = (share) => `${Math.round(share * 100)} %`;
const formatDateTime = (iso) => new Date(iso).toLocaleString("es", {
  weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
}).replace(/\./g, "");
const formatClock = (iso) => new Date(iso).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
const formatWeek = (date) => date.toLocaleDateString("es", { day: "numeric", month: "short" }).replace(/\./g, "");
const hourRange = (hour) => `${String(hour).padStart(2, "0")}:00–${String((hour + 1) % 24).padStart(2, "0")}:00`;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const emptyState = (text) => el("p", "empty-state", text);

/* ------------------------------------------------------------------ SECCIONES */

function renderScore(tasks) {
  const { impulses, deviations, score, completedBlocks, failedBlocks } = scoreSummary(tasks);
  byId("score-value").textContent = formatNumber(score);
  byId("score-value").classList.toggle("score-card__value--negative", score < 0);
  byId("score-impulses").textContent = `+${formatNumber(impulses)}`;
  byId("score-deviations").textContent = `−${formatNumber(deviations)}`;
  byId("score-impulses-count").textContent = `${completedBlocks} ${completedBlocks === 1 ? "bloque cumplido" : "bloques cumplidos"}`;
  byId("score-deviations-count").textContent = `${failedBlocks} ${failedBlocks === 1 ? "bloque no cumplido" : "bloques no cumplidos"}`;
}

function renderHistory(tasks, categories, limit) {
  const list = byId("history-list");
  const more = byId("history-more");
  const movements = pointsHistory(tasks, categories);
  if (!movements.length) {
    list.replaceChildren(emptyState("Aún no tienes movimientos. Cuando respondas «¿Terminaste la tarea?» al final de un bloque, aquí verás de dónde vienen tus puntos."));
    more.hidden = true;
    return;
  }
  list.replaceChildren(...movements.slice(0, limit).map((movement) => {
    const impulse = movement.type === MOVEMENT_TYPE.IMPULSE;
    const item = el("li", `movement movement--${impulse ? "up" : "down"}`);
    const badge = el("span", "movement__badge", impulse ? "↑" : "↓");
    badge.setAttribute("aria-hidden", "true");

    const info = el("div", "movement__info");
    const title = el("p", "movement__title", movement.taskTitle);
    const meta = el("p", "movement__meta");
    const chip = el("span", "movement__category");
    const dot = el("i", "movement__dot");
    dot.style.background = movement.category.color;
    chip.append(dot, document.createTextNode(movement.category.name));
    meta.append(
      chip,
      document.createTextNode(` · ${impulse ? "Impulso" : "Desvío"} · bloque ${formatClock(movement.blockStart)}–${formatClock(movement.blockEnd)}`),
    );
    const when = el("p", "movement__when", `${formatDateTime(movement.resolvedAt)}${movement.source === "timeout" ? " · sin respuesta en 24 h" : ""}`);
    info.append(title, meta, when);

    const points = el("strong", "movement__points", `${impulse ? "+" : "−"}${formatNumber(movement.points)}`);
    points.setAttribute("aria-label", `${impulse ? "Más" : "Menos"} ${movement.points} puntos`);
    item.append(badge, info, points);
    return item;
  }));
  more.hidden = movements.length <= limit;
}

function renderDistribution(tasks, categories, nowMs) {
  const root = byId("distribution");
  const { totalMinutes, items, top } = timeByCategory(tasks, categories, { nowMs });
  if (!totalMinutes) {
    root.replaceChildren(emptyState("Todavía no hay bloques completados. Cuando completes alguno verás en qué inviertes tu tiempo."));
    return;
  }
  // Más de MAX_SLICES categorías: el resto se agrupa en "Otras".
  const shown = items.length > MAX_SLICES + 1 ? items.slice(0, MAX_SLICES) : items;
  const rest = items.slice(shown.length);
  const slices = shown.map((item) => ({ name: item.category.name, color: item.category.color, minutes: item.minutes, share: item.share }));
  if (rest.length) {
    const minutes = rest.reduce((sum, item) => sum + item.minutes, 0);
    slices.push({ name: `Otras (${rest.length})`, color: OTHER_COLOR, minutes, share: minutes / totalMinutes });
  }

  const chart = el("div", "distribution__chart");
  chart.append(doughnutChart(
    slices.map((slice) => ({
      label: slice.name, value: slice.minutes, color: slice.color,
      tip: `${slice.name}: ${formatPercent(slice.share)} · ${formatDuration(slice.minutes)}`,
    })),
    { centerValue: formatHours(totalMinutes), centerLabel: "completadas", ariaLabel: "Distribución del tiempo completado por categoría" },
  ));

  const legend = el("ul", "legend");
  slices.forEach((slice) => {
    const row = el("li", "legend__row");
    const swatch = el("i", "legend__swatch");
    swatch.style.background = slice.color;
    row.append(swatch, el("span", "legend__name", slice.name), el("span", "legend__value", formatPercent(slice.share)), el("span", "legend__time", formatDuration(slice.minutes)));
    legend.append(row);
  });

  const headline = el("p", "distribution__headline");
  headline.append("Dedicas más tiempo a ", el("strong", "", top.category.name), ` (${formatPercent(top.share)}, ${formatDuration(top.minutes)}).`);

  const side = el("div", "distribution__side");
  side.append(headline, legend);
  root.replaceChildren(chart, side, dataTable(
    "Tiempo completado por categoría",
    ["Categoría", "Porcentaje", "Tiempo"],
    slices.map((slice) => [slice.name, formatPercent(slice.share), formatDuration(slice.minutes)]),
  ));
}

function tile(label, value, sub, modifier = "") {
  const node = el("div", `stat-tile ${modifier}`.trim());
  node.append(el("span", "stat-tile__label", label), el("strong", "stat-tile__value", value));
  if (sub) node.append(sub instanceof Node ? sub : el("span", "stat-tile__sub", sub));
  return node;
}

function renderProductivity(tasks, now) {
  const data = productivitySummary(tasks, now);
  let comparison;
  if (data.changePct === null) {
    comparison = el("span", "stat-tile__sub", "Sin tiempo enfocado la semana anterior para comparar");
  } else {
    const up = data.changePct >= 0;
    comparison = el("span", `stat-tile__sub stat-tile__trend stat-tile__trend--${up ? "up" : "down"}`,
      `${up ? "▲" : "▼"} ${Math.abs(data.changePct)} % frente a la semana anterior (${formatDuration(data.lastWeek.focusMinutes)})`);
  }
  const scheduled = data.thisWeek.scheduledMinutes;
  byId("productivity-tiles").replaceChildren(
    tile("Horas enfocadas", formatHours(data.totalFocusMinutes),
      data.pomodoroMeasuredBlocks
        ? `${data.pomodoroMeasuredBlocks} ${data.pomodoroMeasuredBlocks === 1 ? "bloque medido" : "bloques medidos"} con Pomodoro`
        : "Total histórico de bloques completados", "stat-tile--primary"),
    tile("Esta semana", formatDuration(data.thisWeek.focusMinutes), comparison),
    tile("Promedio diario", formatDuration(data.dailyAverageMinutes), `En ${data.daysElapsed} ${data.daysElapsed === 1 ? "día" : "días"} de esta semana`),
    tile("Completado / programado", scheduled ? `${formatDuration(data.thisWeek.completedMinutes)}` : "—",
      scheduled ? `de ${formatDuration(scheduled)} programadas esta semana` : "No hay bloques programados esta semana"),
  );
}

function renderHours(tasks, categories, nowMs) {
  const root = byId("hours-chart");
  const summary = byId("hours-summary");
  const { hours, best } = productiveHours(tasks, categories, nowMs);
  const active = hours.filter((slot) => slot.completed || slot.failed);
  if (!best) {
    summary.textContent = "";
    root.replaceChildren(emptyState("Todavía no hay bloques completados para saber en qué horario rindes más."));
    return;
  }
  const rateText = best.rate === null ? "" : ` (${formatPercent(best.rate)} de cumplimiento)`;
  summary.textContent = `Tu mejor franja es ${hourRange(best.hour)}: ${best.completed} ${best.completed === 1 ? "bloque completado" : "bloques completados"}${rateText}.`
    + (best.category ? ` Ahí trabajas sobre todo en ${best.category.name}.` : "");

  // Se muestra el tramo del día con actividad (mínimo 8 horas de ancho para que se lea bien).
  let first = Math.min(...active.map((slot) => slot.hour));
  let last = Math.max(...active.map((slot) => slot.hour));
  while (last - first < 7) {
    if (first > 0) first -= 1;
    if (last - first < 7 && last < 23) last += 1;
  }
  const visible = hours.slice(first, last + 1);
  root.replaceChildren(
    barChart(visible.map((slot) => ({
      label: String(slot.hour).padStart(2, "0"),
      value: slot.completed,
      highlight: slot.hour === best.hour,
      tip: `${hourRange(slot.hour)} · ${slot.completed} completados, ${slot.failed} no cumplidos`
        + (slot.rate === null ? "" : ` (${formatPercent(slot.rate)})`),
    })), {
      ariaLabel: "Bloques completados según la hora de inicio",
      tickEvery: visible.length > 12 ? 2 : 1,
    }),
    dataTable("Bloques por hora de inicio", ["Franja", "Completados", "No cumplidos", "Cumplimiento"],
      active.map((slot) => [hourRange(slot.hour), slot.completed, slot.failed, slot.rate === null ? "—" : formatPercent(slot.rate)])),
  );
}

function renderFreeTime(tasks, now) {
  const root = byId("free-time");
  const data = weeklyFreeTime(tasks, now);
  const note = el("p", "note", "Es el tiempo libre entre tus bloques de Muven, de la primera a la última actividad de cada día. No es tu disponibilidad real: no incluye lo que no está en tu calendario.");
  if (!data.enoughData) {
    root.replaceChildren(emptyState("Todavía no hay información suficiente: programa al menos 2 bloques esta semana para medir los huecos entre ellos."), note);
    return;
  }
  const headline = el("p", "free-time__headline", describeFreeTime(data.totalMinutes));
  const list = el("ul", "free-time__days");
  data.days.forEach((day) => {
    const [y, m, d] = day.date.split("-").map(Number);
    const label = new Date(y, m - 1, d).toLocaleDateString("es", { weekday: "long", day: "numeric" });
    const row = el("li", "free-time__day");
    row.append(el("span", "", label), el("strong", "", day.freeMinutes ? formatDuration(day.freeMinutes) : "sin huecos"));
    list.append(row);
  });
  root.replaceChildren(headline, list, note);
}

function renderEvolution(tasks, now) {
  const root = byId("evolution");
  const weeks = weeklyEvolution(tasks, now, 8);
  const hasData = weeks.some((week) => week.focusMinutes || week.completed || week.failed) || weeks.some((week) => week.score);
  if (!hasData) {
    root.replaceChildren(emptyState("Aún no hay actividad en las últimas semanas. Tu evolución aparecerá aquí a medida que completes bloques."));
    return;
  }
  const label = (week) => formatWeek(week.from);
  const card = (title, chart, extra) => {
    const node = el("figure", "evolution__chart");
    node.append(el("figcaption", "subsection-title", title));
    if (extra) node.append(extra);
    node.append(chart);
    return node;
  };
  const legend = el("p", "mini-legend");
  legend.append(el("i", "mini-legend__swatch mini-legend__swatch--ok"), "Cumplidos ", el("i", "mini-legend__swatch mini-legend__swatch--bad"), "No cumplidos");

  root.replaceChildren(
    card("Horas enfocadas", barChart(weeks.map((week) => ({
      label: label(week), value: Math.round((week.focusMinutes / 60) * 10) / 10,
      tip: `Semana del ${label(week)}: ${formatDuration(week.focusMinutes)} enfocadas`,
    })), { ariaLabel: "Horas enfocadas por semana", formatTick: (v) => `${v} h` })),
    card("Bloques cumplidos y no cumplidos", barChart(weeks.map((week) => ({
      label: label(week),
      parts: [
        { value: week.completed, className: "bars__bar bars__bar--ok" },
        { value: week.failed, className: "bars__bar bars__bar--bad" },
      ],
      tip: `Semana del ${label(week)}: ${week.completed} cumplidos, ${week.failed} no cumplidos`,
    })), { ariaLabel: "Bloques cumplidos y no cumplidos por semana" }), legend),
    card("Score acumulado", lineChart(weeks.map((week) => ({
      label: label(week), value: week.score, tip: `Al cierre de la semana del ${label(week)}: ${formatNumber(week.score)} puntos`,
    })), { ariaLabel: "Evolución del Score acumulado", formatTick: (v) => formatNumber(v) })),
    dataTable("Evolución semanal", ["Semana", "Horas enfocadas", "Cumplidos", "No cumplidos", "Score acumulado"],
      weeks.map((week) => [label(week), formatDuration(week.focusMinutes), week.completed, week.failed, formatNumber(week.score)])),
  );
}

/* ------------------------------------------------------------------ CONEXIÓN */

/**
 * @param {{
 *   taskService: ReturnType<import("../../application/task.service.js").createTaskService>,
 *   getCategories: () => Object[],
 *   subscribeCategories: (callback: Function) => void,
 *   now?: () => Date
 * }} deps
 * @returns {{ refresh: () => void }}
 */
export function initProgressUi({ taskService, getCategories, subscribeCategories, now = () => new Date() }) {
  const panel = byId("panel-profile");
  let historyLimit = HISTORY_PAGE;
  let frame = 0;

  function render() {
    frame = 0;
    const tasks = taskService.getAll();
    const categories = getCategories();
    const current = now();
    renderScore(tasks);
    renderHistory(tasks, categories, historyLimit);
    renderDistribution(tasks, categories, current.getTime());
    renderProductivity(tasks, current);
    renderHours(tasks, categories, current.getTime());
    renderFreeTime(tasks, current);
    renderEvolution(tasks, current);
  }

  /** Agrupa varios cambios seguidos en un solo redibujado. */
  function schedule() {
    if (!frame) frame = requestAnimationFrame(render);
  }

  byId("history-more").addEventListener("click", () => {
    historyLimit += HISTORY_PAGE;
    render();
  });
  enableTooltips(panel);
  taskService.subscribe(() => {
    historyLimit = HISTORY_PAGE;
    schedule();
  });
  subscribeCategories(schedule);
  render();

  return { refresh: render };
}
