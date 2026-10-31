/**
 * Reglas de arquitectura comprobadas de forma automática (ver docs/DEPENDENCIES.md).
 * Solo cuenta imports reales; las referencias de tipo en JSDoc no crean dependencias.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const src = fileURLToPath(new URL("../../public/src/", import.meta.url));
const files = fs.readdirSync(src, { recursive: true }).filter((f) => f.endsWith(".js") && !f.startsWith("config/")).map((f) => f.split(path.sep).join("/"));
const read = (f) => fs.readFileSync(path.join(src, f), "utf8");
const importsOf = (f) => [...read(f).matchAll(/^\s*import\s[^"']*["']([^"']+)["']/gm)].map((m) => m[1])
  .filter((s) => s.startsWith(".")).map((s) => path.posix.normalize(path.posix.join(path.posix.dirname(f), s)));
const layer = (f) => (f === "main.js" ? "main" : f.split("/")[0]);
const graph = Object.fromEntries(files.map((f) => [f, importsOf(f)]));

const ALLOWED = {
  shared: ["shared"],
  domain: [],
  application: ["application", "domain"],
  infrastructure: ["infrastructure", "domain", "shared"],
  presentation: ["presentation", "domain", "shared"],
  main: ["shared", "application", "infrastructure", "presentation", "domain"],
};

test("cada capa solo importa las capas permitidas", () => {
  const violations = files.flatMap((f) => graph[f].filter((d) => layer(d) !== layer(f) && !ALLOWED[layer(f)].includes(layer(d))).map((d) => `${f} → ${d}`));
  assert.deepEqual(violations, []);
});

test("todas las importaciones relativas existen", () => {
  const missing = files.flatMap((f) => graph[f].filter((d) => !fs.existsSync(path.join(src, d))).map((d) => `${f} → ${d}`));
  assert.deepEqual(missing, []);
});

test("sin dependencias circulares", () => {
  const state = {}; const cycles = [];
  const visit = (f, stack) => {
    if (state[f] === "done") return;
    if (state[f] === "visiting") { cycles.push([...stack.slice(stack.indexOf(f)), f].join(" → ")); return; }
    state[f] = "visiting"; graph[f]?.forEach((d) => visit(d, [...stack, f])); state[f] = "done";
  };
  files.forEach((f) => visit(f, []));
  assert.deepEqual(cycles, []);
});

test("solo infrastructure/firebase conoce Firebase; solo calendar.view conoce FullCalendar", () => {
  for (const f of files) {
    const code = read(f).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    if (!f.startsWith("infrastructure/firebase/")) assert.doesNotMatch(code, /gstatic|firebase\.config|fsApi|authApi/, f);
    if (f !== "presentation/calendar/calendar.view.js") assert.doesNotMatch(code, /FullCalendar/, f);
    if (!f.startsWith("presentation/") && !f.startsWith("shared/") && f !== "main.js") assert.doesNotMatch(code, /document\.|byId\(/, `${f} no debe tocar el DOM`);
  }
});

test("sin código de depuración", () => {
  for (const f of files) assert.doesNotMatch(read(f), /console\.(log|debug)|debugger/, f);
});

test("cada id usado desde JS existe en index.html", () => {
  const html = fs.readFileSync(path.join(src, "../index.html"), "utf8");
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  const byIdCalls = (code) => [...code.matchAll(/(?:byId|getElementById)\(\s*"([^"]+)"/g)].map((m) => m[1]);
  const fieldMaps = (code) => [...code.matchAll(/const FIELDS = \{([^}]*)\}/g)].flatMap((m) => [...m[1].matchAll(/"([^"]+)"/g)].map((v) => v[1]));
  const used = new Set(files.flatMap((f) => [...byIdCalls(read(f)), ...fieldMaps(read(f))]));
  assert.deepEqual([...used].filter((id) => !ids.has(id)), []);
  assert.ok(used.size >= 25, `se esperaban ≥25 ids usados, hay ${used.size}`);
});
