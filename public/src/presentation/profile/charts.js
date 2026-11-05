/**
 * GRÁFICOS SVG del perfil (sin librerías). Solo dibujan lo que reciben: no calculan estadísticas.
 * - Marcas finas, extremos redondeados apoyados en la línea base, rejilla discreta.
 * - Un solo eje Y por gráfico (las magnitudes distintas van en gráficos separados).
 * - Cada marca tiene tooltip al pasar el cursor (data-tip) y cada gráfico ofrece su tabla.
 * - Los textos del usuario (categorías, tareas) se insertan con textContent, nunca como HTML.
 */
const SVG_NS = "http://www.w3.org/2000/svg";

function svgEl(tag, attrs = {}, text) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  if (text !== undefined) node.textContent = text;
  return node;
}

function htmlEl(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/* ------------------------------------------------------------------ TOOLTIP COMPARTIDO */

let tooltip = null;

/** Activa el tooltip para todas las marcas [data-tip] dentro de `root`. */
export function enableTooltips(root) {
  if (!tooltip) {
    tooltip = htmlEl("div", "chart-tooltip");
    tooltip.setAttribute("role", "tooltip");
    tooltip.hidden = true;
    document.body.append(tooltip);
  }
  const hide = () => { tooltip.hidden = true; };
  root.addEventListener("pointermove", (event) => {
    const mark = event.target.closest?.("[data-tip]");
    if (!mark || !root.contains(mark)) return hide();
    tooltip.textContent = mark.getAttribute("data-tip");
    tooltip.hidden = false;
    const { innerWidth } = window;
    const width = tooltip.offsetWidth;
    tooltip.style.left = `${Math.min(innerWidth - width - 8, Math.max(8, event.clientX - width / 2))}px`;
    tooltip.style.top = `${event.clientY - tooltip.offsetHeight - 12}px`;
  });
  root.addEventListener("pointerleave", hide);
  root.addEventListener("scroll", hide, true);
}

/** Tabla accesible plegable con los mismos datos del gráfico. */
export function dataTable(caption, headers, rows) {
  const details = htmlEl("details", "chart-table");
  details.append(htmlEl("summary", "", "Ver como tabla"));
  const table = htmlEl("table");
  table.append(htmlEl("caption", "sr-only", caption));
  const head = htmlEl("tr");
  headers.forEach((header) => head.append(htmlEl("th", "", header)));
  table.append(head);
  rows.forEach((row) => {
    const tr = htmlEl("tr");
    row.forEach((cell) => tr.append(htmlEl("td", "", String(cell))));
    table.append(tr);
  });
  details.append(table);
  return details;
}

/* ------------------------------------------------------------------ DONA */

/**
 * @param {{label: string, value: number, color: string, tip: string}[]} items  value > 0
 * @param {{centerValue: string, centerLabel: string, ariaLabel: string}} options
 */
export function doughnutChart(items, { centerValue, centerLabel, ariaLabel }) {
  const size = 200;
  const radius = 80;
  const thickness = 26;
  const svg = svgEl("svg", { viewBox: `0 0 ${size} ${size}`, class: "doughnut", role: "img", "aria-label": ariaLabel });
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const center = size / 2;
  const gap = items.length > 1 ? 0.012 : 0; // separación entre porciones (fracción de vuelta)
  let angle = -Math.PI / 2;

  const point = (a, r) => [center + r * Math.cos(a), center + r * Math.sin(a)];
  items.forEach((item) => {
    const sweep = (item.value / total) * Math.PI * 2;
    const start = angle + (gap * Math.PI);
    const end = angle + sweep - (gap * Math.PI);
    angle += sweep;
    if (sweep >= Math.PI * 2 - 1e-6) {
      svg.append(svgEl("circle", {
        cx: center, cy: center, r: radius, fill: "none", stroke: item.color, "stroke-width": thickness, "data-tip": item.tip, class: "doughnut__slice",
      }));
      return;
    }
    if (end <= start) return;
    const [x1, y1] = point(start, radius);
    const [x2, y2] = point(end, radius);
    const large = end - start > Math.PI ? 1 : 0;
    svg.append(svgEl("path", {
      d: `M ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2}`,
      fill: "none",
      stroke: item.color,
      "stroke-width": thickness,
      "stroke-linecap": "butt",
      "data-tip": item.tip,
      class: "doughnut__slice",
    }));
  });
  svg.append(svgEl("text", { x: center, y: center - 2, class: "doughnut__value", "text-anchor": "middle" }, centerValue));
  svg.append(svgEl("text", { x: center, y: center + 18, class: "doughnut__label", "text-anchor": "middle" }, centerLabel));
  return svg;
}

/* ------------------------------------------------------------------ BARRAS */

/**
 * Barras verticales de una sola serie (o apiladas si cada valor trae `parts`).
 * @param {{label: string, value?: number, parts?: {value: number, className: string}[], tip: string, highlight?: boolean}[]} bars
 * @param {{ariaLabel: string, height?: number, tickEvery?: number, formatTick?: (v: number) => string}} options
 */
export function barChart(bars, { ariaLabel, height = 160, tickEvery = 1, formatTick = (v) => String(v) }) {
  const width = 320;
  const pad = { top: 12, right: 6, bottom: 22, left: 30 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const totals = bars.map((bar) => (bar.parts ? bar.parts.reduce((sum, part) => sum + part.value, 0) : bar.value ?? 0));
  const max = Math.max(1, ...totals);
  const niceMax = niceCeil(max);
  const svg = svgEl("svg", { viewBox: `0 0 ${width} ${height}`, class: "bars", role: "img", "aria-label": ariaLabel });

  // Rejilla: 0, mitad y máximo
  [0, niceMax / 2, niceMax].forEach((tick) => {
    const y = pad.top + plotH - (tick / niceMax) * plotH;
    svg.append(svgEl("line", { x1: pad.left, x2: width - pad.right, y1: y, y2: y, class: tick === 0 ? "bars__baseline" : "bars__grid" }));
    svg.append(svgEl("text", { x: pad.left - 6, y: y + 3, class: "bars__tick", "text-anchor": "end" }, formatTick(tick)));
  });

  const slot = plotW / bars.length;
  const barW = Math.max(3, Math.min(28, slot * 0.62));
  bars.forEach((bar, index) => {
    const x = pad.left + slot * index + (slot - barW) / 2;
    const group = svgEl("g", { "data-tip": bar.tip, class: "bars__hit" });
    // Zona de acierto más grande que la barra
    group.append(svgEl("rect", { x: pad.left + slot * index, y: pad.top, width: slot, height: plotH, class: "bars__target" }));
    let base = pad.top + plotH;
    const parts = bar.parts ?? [{ value: bar.value ?? 0, className: bar.highlight ? "bars__bar bars__bar--highlight" : "bars__bar" }];
    parts.forEach((part, partIndex) => {
      const h = (part.value / niceMax) * plotH;
      if (h <= 0) return;
      const isTop = parts.slice(partIndex + 1).every((rest) => rest.value <= 0);
      const y = base - h;
      group.append(svgEl("path", { d: roundedTopRect(x, y, barW, h, isTop ? Math.min(4, h, barW / 2) : 0), class: part.className }));
      base = y - (isTop ? 0 : 2); // 2 px de separación entre segmentos apilados
    });
    svg.append(group);
    if (index % tickEvery === 0) {
      svg.append(svgEl("text", { x: x + barW / 2, y: height - 6, class: "bars__tick", "text-anchor": "middle" }, bar.label));
    }
  });
  return svg;
}

/* ------------------------------------------------------------------ LÍNEA */

/**
 * @param {{label: string, value: number, tip: string}[]} points
 * @param {{ariaLabel: string, height?: number, formatTick?: (v: number) => string}} options
 */
export function lineChart(points, { ariaLabel, height = 160, formatTick = (v) => String(v) }) {
  const width = 320;
  const pad = { top: 16, right: 14, bottom: 22, left: 36 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const values = points.map((p) => p.value);
  const min = Math.min(0, ...values);
  const max = Math.max(1, ...values);
  const top = niceCeil(max);
  const bottom = min < 0 ? -niceCeil(-min) : 0;
  const yOf = (v) => pad.top + plotH - ((v - bottom) / (top - bottom)) * plotH;
  const xOf = (i) => pad.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const svg = svgEl("svg", { viewBox: `0 0 ${width} ${height}`, class: "line", role: "img", "aria-label": ariaLabel });

  [bottom, (bottom + top) / 2, top].forEach((tick) => {
    svg.append(svgEl("line", { x1: pad.left, x2: width - pad.right, y1: yOf(tick), y2: yOf(tick), class: tick === 0 ? "bars__baseline" : "bars__grid" }));
    svg.append(svgEl("text", { x: pad.left - 6, y: yOf(tick) + 3, class: "bars__tick", "text-anchor": "end" }, formatTick(Math.round(tick))));
  });
  if (bottom < 0 && top > 0) {
    svg.append(svgEl("line", { x1: pad.left, x2: width - pad.right, y1: yOf(0), y2: yOf(0), class: "bars__baseline" }));
  }
  svg.append(svgEl("polyline", { points: points.map((p, i) => `${xOf(i)},${yOf(p.value)}`).join(" "), class: "line__path" }));
  points.forEach((p, i) => {
    const group = svgEl("g", { "data-tip": p.tip, class: "bars__hit" });
    group.append(svgEl("rect", { x: xOf(i) - plotW / points.length / 2, y: pad.top, width: plotW / points.length, height: plotH, class: "bars__target" }));
    group.append(svgEl("circle", { cx: xOf(i), cy: yOf(p.value), r: i === points.length - 1 ? 5 : 4, class: "line__dot" }));
    svg.append(group);
    svg.append(svgEl("text", { x: xOf(i), y: height - 6, class: "bars__tick", "text-anchor": "middle" }, p.label));
  });
  // Etiqueta directa solo en el último punto (valor actual)
  const last = points[points.length - 1];
  if (last) {
    svg.append(svgEl("text", {
      x: xOf(points.length - 1), y: yOf(last.value) - 9, class: "line__label", "text-anchor": "end",
    }, formatTick(last.value)));
  }
  return svg;
}

/* ------------------------------------------------------------------ UTILIDADES */

function niceCeil(value) {
  if (value <= 1) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const steps = [1, 2, 2.5, 5, 10];
  const step = steps.find((s) => s * magnitude >= value) ?? 10;
  return step * magnitude;
}

/** Rectángulo con las esquinas superiores redondeadas (la base queda recta, apoyada en el eje). */
function roundedTopRect(x, y, w, h, r) {
  if (r <= 0) return `M ${x} ${y} h ${w} v ${h} h ${-w} Z`;
  return `M ${x} ${y + h} V ${y + r} Q ${x} ${y} ${x + r} ${y} H ${x + w - r} Q ${x + w} ${y} ${x + w} ${y + r} V ${y + h} Z`;
}
