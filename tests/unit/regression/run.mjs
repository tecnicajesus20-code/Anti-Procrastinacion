// Uso: node --import ./fakes/register.mjs run.mjs <raizProyecto> <escenario> [--firebase] [--mobile] [--store=archivo]
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";
import { fake } from "./fakes/state.js";
import { scenarios } from "./scenarios.mjs";

const [rootArg, scenarioName, ...flags] = process.argv.slice(2);
const has = (f) => flags.includes(f);
const storeFile = flags.find((f) => f.startsWith("--store="))?.slice(8);

// Copia del proyecto para poder añadir firebase.config.js sin tocar el original
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "muven-"));
fs.cpSync(path.join(rootArg, "public"), path.join(tmp, "public"), { recursive: true });
if (has("--firebase")) {
  fs.writeFileSync(path.join(tmp, "public/src/config/firebase.config.js"), 'export const firebaseConfig = { apiKey: "fake", projectId: "fake" };\n');
}
if (storeFile && fs.existsSync(storeFile)) {
  const s = JSON.parse(fs.readFileSync(storeFile, "utf8"));
  fake.users = new Map(s.users); fake.docs = new Map(s.docs); fake.nextId = s.nextId;
  if (s.currentEmail) fake.current = fake.users.get(s.currentEmail); // sesión persistida (como Firebase en el navegador)
}

const html = fs.readFileSync(path.join(tmp, "public/index.html"), "utf8").replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, "");
const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true, url: "http://localhost/" });
const { window } = dom;
if (has("--mobile")) Object.defineProperty(window, "innerWidth", { value: 400, configurable: true });
window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
window.HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
window.eval(fs.readFileSync(new URL("../../node_modules/fullcalendar/index.global.js", import.meta.url), "utf8"));

// Captura la instancia de Calendar que cree la app (sea cual sea el archivo que lo haga)
let calendar = null;
const Original = window.FullCalendar.Calendar;
window.FullCalendar.Calendar = class extends Original { constructor(...a) { super(...a); calendar = this; } };
const consoleLogs = [];
const origLog = console.log; console.log = (...a) => consoleLogs.push(a.join(" "));
const origWarn = console.warn; console.warn = (...a) => consoleLogs.push("WARN " + a.join(" "));
const origErr = console.error; console.error = (...a) => consoleLogs.push("ERROR " + a.join(" "));

globalThis.window = window;
globalThis.document = window.document;
for (const k of ["HTMLElement", "Node", "Event", "SubmitEvent", "MouseEvent", "HTMLFormElement"]) globalThis[k] = window[k];

// Reloj falso solo para el Pomodoro (FullCalendar usa los temporizadores de jsdom, no estos)
const intervals = new Map(); let nextTimer = 1;
globalThis.setInterval = (fn) => { const id = nextTimer++; intervals.set(id, fn); return id; };
globalThis.clearInterval = (id) => intervals.delete(id);
const tickSeconds = (n) => { for (let i = 0; i < n; i++) [...intervals.values()].forEach((fn) => fn()); };

const settle = async (ms = 30) => { for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, ms / 5)); };
const $ = (id) => window.document.getElementById(id);

function snapshot() {
  const msg = $("message");
  const iso = (d) => (d ? d.toISOString() : null);
  return {
    userLabel: $("user-label").textContent,
    message: msg.hidden ? null : { text: msg.textContent, className: msg.className },
    loadingVisible: !$("loading").hidden,
    logoutVisible: !$("auth-logout").hidden,
    authDisabled: $("auth-login").disabled,
    authNote: $("auth-note").textContent,
    dialogOpen: $("event-dialog").hasAttribute("open"),
    dialog: { title: $("event-title").value, start: $("event-start").value, end: $("event-end").value, description: $("event-description").value },
    taskForm: ["task-title", "task-description", "task-start", "task-end", "task-due"].map((id) => $(id).value),
    list: [...$("task-list").children].map((li) => ({
      cls: li.className, title: li.querySelector(".task-title")?.textContent, time: li.querySelector(".task-time")?.textContent,
      buttons: [...li.querySelectorAll("button")].map((b) => `${b.className}:${b.textContent}`),
    })),
    calendar: calendar && {
      view: calendar.view.type,
      events: calendar.getEvents().map((e) => ({ title: e.title, start: iso(e.start), end: iso(e.end), cls: e.classNames.join(" ") }))
        .sort((a, b) => (a.start + a.title).localeCompare(b.start + b.title)),
      toolbar: [...window.document.querySelectorAll(".fc-toolbar button")].map((b) => b.className.split(" ").find((c) => c.startsWith("fc-") && c.endsWith("-button"))),
    },
    pomodoro: { mode: $("pomodoro-mode").textContent, time: $("pomodoro-time").textContent },
    firestore: [...fake.docs].map(([p, d]) => ({ path: p.replace(/fs-\d+$/, "fs-N"), ...d })).sort((a, b) => (a.path + a.title).localeCompare(b.path + b.title)),
    console: consoleLogs,
  };
}

const api = {
  window, $, settle, snapshot, tickSeconds, fake, get calendar() { return calendar; },
  set(id, v) { $(id).value = v; },
  submit(id) { $(id).requestSubmit(); },
  click(id) { $(id).click(); },
  clickListButton(title, text) {
    const li = [...$("task-list").children].find((x) => x.querySelector(".task-title").textContent === title);
    [...li.querySelectorAll("button")].find((b) => b.textContent === text).click();
  },
  selectSlot(start, end) { calendar.getOption("select")({ start, end, allDay: false }); },
  // Simula lo que hace FullCalendar al soltar o redimensionar un evento
  async moveEvent(title, newStart, newEnd, kind = "eventDrop") {
    const ev = calendar.getEvents().find((e) => e.title === title);
    const oldEvent = { start: ev.start, end: ev.end };
    ev.setDates(newStart, newEnd);
    let reverted = false;
    await calendar.getOption(kind)({ event: ev, oldEvent, revert: () => { reverted = true; ev.setDates(oldEvent.start, oldEvent.end); } });
    await settle();
    return reverted;
  },
};

const out = { scenario: scenarioName, steps: [] };
api.step = (label) => out.steps.push({ label, ...snapshot() });
try {
  await import(pathToFileURL(path.join(tmp, "public/src/main.js")).href);
  await settle(60);
  await scenarios[scenarioName](api);
} catch (e) { out.crash = String(e.stack || e); }
if (storeFile) fs.writeFileSync(storeFile, JSON.stringify({ users: [...fake.users], docs: [...fake.docs], nextId: fake.nextId, currentEmail: fake.current?.email ?? null }));
console.log = origLog;
process.stdout.write(JSON.stringify(out, null, 1) + "\n");
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(0);
