/**
 * SELECTOR DE FECHA Y HORA propio (reemplaza el calendario nativo del navegador, que no se puede estilizar).
 * Se engancha a los <input type="datetime-local"> existentes: lee y escribe su `value`
 * ("AAAA-MM-DDTHH:mm"), así el resto de la app (readTaskInput, dateToLocalInputValue…) no cambia.
 * Se muestra en la capa superior (Popover API) para quedar por encima de los <dialog> modales.
 */
const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];
const pad = (n) => String(n).padStart(2, "0");
const toValue = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

function parseValue(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value ?? "");
  if (!match) return null;
  const [, y, m, d, h, min] = match.map(Number);
  const date = new Date(y, m - 1, d, h, min);
  return Number.isNaN(date.getTime()) || y < 1900 || y > 2200 ? null : date;
}

function defaultDate() {
  const now = new Date();
  now.setSeconds(0, 0);
  now.setMinutes(Math.ceil(now.getMinutes() / 5) * 5);
  return now;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function iconButton(className, label, symbol) {
  const button = el("button", className, symbol);
  button.type = "button";
  button.setAttribute("aria-label", label);
  return button;
}

/** Crea (una sola vez) la ventanita compartida por todos los campos. */
function createPicker() {
  const root = el("div", "dtp");
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-label", "Elegir fecha y hora");
  const supportsPopover = typeof root.showPopover === "function";
  if (supportsPopover) root.popover = "manual";

  // Cabecera: mes + flechas
  const head = el("div", "dtp__head");
  const prev = iconButton("dtp__nav", "Mes anterior", "‹");
  const monthLabel = el("p", "dtp__month");
  const next = iconButton("dtp__nav", "Mes siguiente", "›");
  head.append(prev, monthLabel, next);

  const weekdays = el("div", "dtp__weekdays");
  WEEKDAYS.forEach((day) => weekdays.append(el("span", "", day)));
  const grid = el("div", "dtp__grid");

  // Hora: [−] 09 [+] : [−] 30 [+]   a. m. | p. m.
  const time = el("div", "dtp__time");
  const timeLabel = el("span", "dtp__time-label", "Hora");
  const hourBox = el("div", "dtp__spin");
  const hourDown = iconButton("dtp__step", "Hora anterior", "−");
  const hourText = el("span", "dtp__digits");
  const hourUp = iconButton("dtp__step", "Hora siguiente", "+");
  hourBox.append(hourDown, hourText, hourUp);
  const minuteBox = el("div", "dtp__spin");
  const minuteDown = iconButton("dtp__step", "Restar 5 minutos", "−");
  const minuteText = el("span", "dtp__digits");
  const minuteUp = iconButton("dtp__step", "Sumar 5 minutos", "+");
  minuteBox.append(minuteDown, minuteText, minuteUp);
  const meridiem = el("div", "dtp__meridiem");
  const am = el("button", "dtp__seg", "a. m.");
  const pm = el("button", "dtp__seg", "p. m.");
  am.type = pm.type = "button";
  meridiem.append(am, pm);
  const clock = el("div", "dtp__clock");
  clock.append(hourBox, el("span", "dtp__colon", ":"), minuteBox);
  time.append(timeLabel, clock, meridiem);

  const foot = el("div", "dtp__foot");
  const today = el("button", "dtp__link", "Hoy");
  const done = el("button", "dtp__done", "Listo");
  today.type = done.type = "button";
  foot.append(today, done);

  root.append(head, weekdays, grid, time, foot);
  document.body.append(root);

  let input = null;
  let selected = null; // Date elegida
  let view = null; // primer día del mes que se muestra

  function commit() {
    if (!input || !selected) return;
    input.value = toValue(selected);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function render() {
    monthLabel.textContent = view.toLocaleDateString("es", { month: "long", year: "numeric" });
    const offset = (view.getDay() + 6) % 7; // lunes = 0
    const start = new Date(view.getFullYear(), view.getMonth(), 1 - offset);
    const now = new Date();
    const cells = [];
    for (let i = 0; i < 42; i += 1) {
      const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const cell = el("button", "dtp__day", String(day.getDate()));
      cell.type = "button";
      if (day.getMonth() !== view.getMonth()) cell.classList.add("dtp__day--out");
      if (sameDay(day, now)) cell.classList.add("dtp__day--today");
      if (selected && sameDay(day, selected)) {
        cell.classList.add("dtp__day--selected");
        cell.setAttribute("aria-pressed", "true");
      }
      cell.setAttribute("aria-label", day.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" }));
      cell.addEventListener("click", () => {
        const base = selected ?? defaultDate();
        selected = new Date(day.getFullYear(), day.getMonth(), day.getDate(), base.getHours(), base.getMinutes());
        if (day.getMonth() !== view.getMonth()) view = new Date(day.getFullYear(), day.getMonth(), 1);
        commit();
        render();
      });
      cells.push(cell);
    }
    grid.replaceChildren(...cells);

    const shown = selected ?? defaultDate();
    const hours = shown.getHours();
    hourText.textContent = pad(hours % 12 || 12);
    minuteText.textContent = pad(shown.getMinutes());
    am.classList.toggle("dtp__seg--on", hours < 12);
    pm.classList.toggle("dtp__seg--on", hours >= 12);
  }

  function changeTime(mutate) {
    selected = new Date(selected ?? defaultDate());
    mutate(selected);
    commit();
    render();
  }

  prev.addEventListener("click", () => { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); render(); });
  next.addEventListener("click", () => { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); render(); });
  hourUp.addEventListener("click", () => changeTime((d) => d.setHours(d.getHours() + 1)));
  hourDown.addEventListener("click", () => changeTime((d) => d.setHours(d.getHours() - 1)));
  minuteUp.addEventListener("click", () => changeTime((d) => d.setMinutes(Math.floor(d.getMinutes() / 5) * 5 + 5)));
  minuteDown.addEventListener("click", () => changeTime((d) => d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5 - 5)));
  am.addEventListener("click", () => changeTime((d) => { if (d.getHours() >= 12) d.setHours(d.getHours() - 12); }));
  pm.addEventListener("click", () => changeTime((d) => { if (d.getHours() < 12) d.setHours(d.getHours() + 12); }));
  today.addEventListener("click", () => {
    const now = new Date();
    changeTime((d) => d.setFullYear(now.getFullYear(), now.getMonth(), now.getDate()));
    view = new Date(now.getFullYear(), now.getMonth(), 1);
    render();
  });
  done.addEventListener("click", () => close());

  function position() {
    const rect = input.getBoundingClientRect();
    const width = root.offsetWidth;
    const height = root.offsetHeight;
    const left = Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8);
    const below = rect.bottom + 8;
    const top = below + height > window.innerHeight - 8 ? Math.max(8, rect.top - height - 8) : below;
    root.style.left = `${left}px`;
    root.style.top = `${top}px`;
  }

  function open(target) {
    if (target.disabled || target.readOnly) return;
    input = target;
    selected = parseValue(target.value);
    const base = selected ?? defaultDate();
    view = new Date(base.getFullYear(), base.getMonth(), 1);
    render();
    // Debe vivir dentro del <dialog> abierto: fuera de él, el diálogo modal lo volvería inerte (no clicable).
    const host = target.closest("dialog") ?? document.body;
    if (supportsPopover) {
      if (root.matches(":popover-open")) root.hidePopover();
      if (root.parentElement !== host) host.append(root);
      root.showPopover();
    } else {
      if (root.parentElement !== host) host.append(root);
      root.classList.add("dtp--open");
    }
    position();
  }

  function close() {
    if (!input) return;
    if (supportsPopover) {
      if (root.matches(":popover-open")) root.hidePopover();
    } else {
      root.classList.remove("dtp--open");
    }
    input = null;
  }

  document.addEventListener("pointerdown", (event) => {
    if (input && !root.contains(event.target) && event.target !== input) close();
  }, true);
  document.addEventListener("keydown", (event) => {
    if (input && event.key === "Escape") {
      event.stopPropagation();
      event.preventDefault(); // que Escape no cierre también el diálogo de la tarea
      const target = input;
      close();
      target.focus();
    }
  }, true);
  window.addEventListener("resize", () => input && position());
  document.addEventListener("scroll", () => input && position(), true);
  document.addEventListener("close", () => close(), true); // si se cierra el <dialog>, se cierra el selector

  return { open, isOpenFor: (target) => input === target, close };
}

let picker = null;

/** Engancha el selector a todos los campos fecha-hora indicados (o a todos los de la página). */
export function initDateTimePickers(inputs = document.querySelectorAll('input[type="datetime-local"]')) {
  picker ??= createPicker();
  inputs.forEach((input) => {
    if (input.dataset.dtp) return;
    input.dataset.dtp = "on";
    input.classList.add("dtp-input");
    input.addEventListener("click", (event) => {
      event.preventDefault(); // evita el calendario nativo (Firefox lo abre al hacer clic)
      if (picker.isOpenFor(input)) picker.close();
      else picker.open(input);
    });
    input.addEventListener("keydown", (event) => {
      if ((event.key === "Enter" || event.key === " " || (event.altKey && event.key === "ArrowDown")) && !picker.isOpenFor(input)) {
        event.preventDefault();
        picker.open(input);
      }
    });
  });
}
