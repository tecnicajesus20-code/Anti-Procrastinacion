/**
 * SELECTOR DE FECHA Y HORA PROPIO (solo apariencia).
 * Reemplaza visualmente el calendario nativo de cada <input type="datetime-local">, que no se puede estilizar.
 *
 * El input nativo SIGUE siendo la fuente de verdad: queda invisible debajo de un botón, conserva su
 * name/id/required y su formato ("2026-11-04T08:00"). Por eso el resto del código no cambia:
 *   - leer/escribir input.value funciona igual (el setter se envuelve para refrescar el botón);
 *   - al elegir en el selector se disparan "input" y "change" como si escribiera el usuario.
 * Si el navegador no soporta la API popover, no se toca nada y queda el control nativo.
 */
const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];
const MINUTE_STEP = 5;
const pad = (n) => String(n).padStart(2, "0");

const monthTitle = new Intl.DateTimeFormat("es", { month: "long", year: "numeric" });
const displayDate = new Intl.DateTimeFormat("es", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

/** "2026-11-04T08:00" → Date local (o null). */
function parseLocal(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value || "");
  if (!match) return null;
  const [, y, m, d, h, min] = match.map(Number);
  return new Date(y, m - 1, d, h, min);
}

/** Date local → "2026-11-04T08:00". */
const toLocal = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;

const sameDay = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(className, text, label) {
  const node = el("button", className, text);
  node.type = "button";
  if (label) node.setAttribute("aria-label", label);
  return node;
}

/** Próxima hora en punto: valor inicial cuando el campo está vacío. */
function nextHour() {
  const date = new Date();
  date.setMinutes(0, 0, 0);
  date.setHours(date.getHours() + 1);
  return date;
}

export function initDateTimePickers(root = document) {
  if (typeof HTMLElement.prototype.showPopover !== "function") return; // navegador antiguo: control nativo
  const inputs = [...root.querySelectorAll('input[type="datetime-local"]')];
  if (!inputs.length) return;

  const nativeValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");

  // ---------- Popover compartido ----------
  const pop = el("div", "dtp-pop");
  pop.popover = "auto";
  pop.setAttribute("role", "dialog");
  pop.setAttribute("aria-label", "Elegir fecha y hora");

  const head = el("div", "dtp-head");
  const prev = button("dtp-nav", "‹", "Mes anterior");
  const title = el("span", "dtp-title");
  const next = button("dtp-nav", "›", "Mes siguiente");
  head.append(prev, title, next);

  const week = el("div", "dtp-week");
  WEEKDAYS.forEach((day) => week.append(el("span", "", day)));
  const grid = el("div", "dtp-grid");

  const timeBox = el("div", "dtp-time");
  const timeLabel = el("span", "dtp-time__label", "Hora");
  const hours = el("div", "dtp-col");
  const minutes = el("div", "dtp-col");
  hours.setAttribute("aria-label", "Hora");
  minutes.setAttribute("aria-label", "Minutos");
  const cols = el("div", "dtp-cols");
  cols.append(hours, el("span", "dtp-colon", ":"), minutes);
  timeBox.append(timeLabel, cols);

  const foot = el("div", "dtp-foot");
  const clearBtn = button("dtp-link", "Borrar");
  const todayBtn = button("dtp-link", "Hoy");
  const doneBtn = button("dtp-done", "Listo");
  foot.append(clearBtn, todayBtn, doneBtn);

  const calendar = el("div", "dtp-cal");
  calendar.append(head, week, grid);
  const body = el("div", "dtp-body");
  body.append(calendar, timeBox);
  pop.append(body, foot);
  document.body.append(pop);

  let active = null; // { input, trigger }
  let viewYear = 0;
  let viewMonth = 0;
  let lastClose = { trigger: null, at: 0 };

  const current = () => (active ? parseLocal(active.input.value) : null);

  function commit(date) {
    const { input } = active;
    input.value = date ? toLocal(date) : "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    render();
  }

  /** Cambia una parte de la fecha conservando las demás. */
  function update(change) {
    const date = current() ?? nextHour();
    change(date);
    commit(date);
  }

  function renderDays() {
    const selected = current();
    const today = new Date();
    title.textContent = monthTitle.format(new Date(viewYear, viewMonth, 1));
    const first = new Date(viewYear, viewMonth, 1);
    const offset = (first.getDay() + 6) % 7; // lunes primero
    const days = [];
    for (let i = 0; i < 42; i += 1) {
      const date = new Date(viewYear, viewMonth, 1 - offset + i);
      const cell = button("dtp-day", String(date.getDate()), displayDate.format(date));
      cell.classList.toggle("is-out", date.getMonth() !== viewMonth);
      cell.classList.toggle("is-today", sameDay(date, today));
      cell.classList.toggle("is-selected", sameDay(date, selected));
      if (sameDay(date, selected)) cell.setAttribute("aria-current", "date");
      cell.addEventListener("click", () => {
        update((d) => d.setFullYear(date.getFullYear(), date.getMonth(), date.getDate()));
        viewYear = date.getFullYear();
        viewMonth = date.getMonth();
        renderDays();
      });
      days.push(cell);
    }
    grid.replaceChildren(...days);
  }

  function renderTime(scroll) {
    const selected = current();
    const h = selected?.getHours();
    const m = selected?.getMinutes();
    const minuteValues = [];
    for (let v = 0; v < 60; v += MINUTE_STEP) minuteValues.push(v);
    if (m !== undefined && !minuteValues.includes(m)) minuteValues.push(m), minuteValues.sort((a, b) => a - b);

    const chips = (values, chosen, apply) => values.map((value) => {
      const chip = button("dtp-chip", pad(value));
      chip.classList.toggle("is-selected", value === chosen);
      chip.addEventListener("click", () => update((d) => apply(d, value)));
      return chip;
    });
    hours.replaceChildren(...chips([...Array(24).keys()], h, (d, v) => d.setHours(v)));
    minutes.replaceChildren(...chips(minuteValues, m, (d, v) => d.setMinutes(v)));

    if (scroll) {
      [hours, minutes].forEach((col) => {
        const chosen = col.querySelector(".is-selected");
        col.scrollTop = chosen ? chosen.offsetTop - col.clientHeight / 2 + chosen.offsetHeight / 2 : 0;
      });
    }
  }

  function render(scroll = false) {
    renderDays();
    renderTime(scroll);
    clearBtn.hidden = !!active?.input.required;
  }

  function place() {
    if (!active) return;
    const rect = active.trigger.getBoundingClientRect();
    const popRect = pop.getBoundingClientRect();
    const gap = 6;
    const below = window.innerHeight - rect.bottom;
    const top = below >= popRect.height + gap || rect.top < popRect.height + gap
      ? Math.min(rect.bottom + gap, window.innerHeight - popRect.height - gap)
      : rect.top - popRect.height - gap;
    const left = Math.min(Math.max(gap, rect.left), window.innerWidth - popRect.width - gap);
    pop.style.top = `${Math.max(gap, top)}px`;
    pop.style.left = `${Math.max(gap, left)}px`;
  }

  function open(input, trigger) {
    active = { input, trigger };
    // Un <dialog> modal vuelve inerte todo lo que está fuera de él: el popover se muda a ese diálogo.
    const host = trigger.closest("dialog") ?? document.body;
    if (pop.parentElement !== host) host.append(pop);
    const base = current() ?? new Date();
    viewYear = base.getFullYear();
    viewMonth = base.getMonth();
    pop.showPopover();
    render(true);
    place();
    trigger.setAttribute("aria-expanded", "true");
    (grid.querySelector(".is-selected") ?? grid.querySelector(".is-today") ?? doneBtn).focus({ preventScroll: true });
  }

  pop.addEventListener("toggle", (event) => {
    if (event.newState !== "closed" || !active) return;
    active.trigger.setAttribute("aria-expanded", "false");
    lastClose = { trigger: active.trigger, at: Date.now() };
    active = null;
  });

  const shiftMonth = (delta) => {
    const date = new Date(viewYear, viewMonth + delta, 1);
    viewYear = date.getFullYear();
    viewMonth = date.getMonth();
    renderDays();
  };
  prev.addEventListener("click", () => shiftMonth(-1));
  next.addEventListener("click", () => shiftMonth(1));
  todayBtn.addEventListener("click", () => {
    const now = new Date();
    viewYear = now.getFullYear();
    viewMonth = now.getMonth();
    update((d) => d.setFullYear(now.getFullYear(), now.getMonth(), now.getDate()));
  });
  clearBtn.addEventListener("click", () => {
    commit(null);
    pop.hidePopover();
  });
  doneBtn.addEventListener("click", () => {
    const trigger = active?.trigger;
    pop.hidePopover();
    trigger?.focus();
  });
  window.addEventListener("resize", place);
  document.addEventListener("scroll", place, true);

  // ---------- Un botón por campo ----------
  inputs.forEach((input) => {
    const wrap = el("span", "dtp");
    const trigger = button("input dtp-trigger");
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.setAttribute("aria-expanded", "false");
    const text = el("span", "dtp-trigger__text");
    const icon = el("span", "dtp-trigger__icon");
    icon.setAttribute("aria-hidden", "true");
    trigger.append(text, icon);

    input.before(wrap);
    wrap.append(trigger, input); // el botón va primero: un clic en el <label> lo activa a él
    input.classList.add("dtp-native");
    input.tabIndex = -1;

    const refresh = () => {
      const date = parseLocal(nativeValue.get.call(input));
      text.textContent = date ? `${displayDate.format(date)} · ${pad(date.getHours())}:${pad(date.getMinutes())}` : "Elegir fecha y hora";
      trigger.classList.toggle("dtp-trigger--empty", !date);
    };

    // Cualquier asignación desde el código (input.value = ...) también refresca el botón.
    Object.defineProperty(input, "value", {
      configurable: true,
      get: () => nativeValue.get.call(input),
      set: (value) => {
        nativeValue.set.call(input, value);
        refresh();
      },
    });
    input.addEventListener("input", refresh);
    input.addEventListener("change", refresh);
    input.form?.addEventListener("reset", () => setTimeout(refresh, 0));
    input.addEventListener("invalid", () => trigger.classList.add("dtp-trigger--invalid"));
    input.addEventListener("change", () => trigger.classList.remove("dtp-trigger--invalid"));

    trigger.addEventListener("click", () => {
      // El clic que cierra el popover (light dismiss) no debe volver a abrirlo.
      if (lastClose.trigger === trigger && Date.now() - lastClose.at < 250) return;
      if (active?.trigger === trigger) return pop.hidePopover();
      open(input, trigger);
    });
    refresh();
  });
}
