/**
 * Pruebas de regresión de caracterización.
 * Ejecuta los mismos escenarios sobre dos árboles del proyecto (referencia y candidato)
 * y compara el estado visible tras cada paso (DOM, eventos del calendario, Firestore falso).
 *
 * Uso: node tests/regression/compare.mjs [dirReferencia] [dirCandidato]
 *   Por defecto la referencia es la rama Desarrollo (se extrae con `git worktree`) y el candidato el árbol actual.
 * Escenarios con diferencia esperada se declaran en EXPECTED_DIFFS con su justificación.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../..");

/** Diferencias aprobadas: escenario → motivo. Cualquier otra diferencia hace fallar la comparación. */
export const EXPECTED_DIFFS = {
  race: "Corrección de aislamiento: una carga de tareas obsoleta ya no sobrescribe la sesión actual (AUD-01).",
  raceWrite: "Corrección de aislamiento: una creación en vuelo ya no se mezcla con la lista de otra sesión (AUD-01).",
};

const RUNS = [
  ["demo", []], ["pomodoro", []], ["mobile", ["--mobile"]], ["demo-fbconfig", ["--firebase"], "demo"],
  ["firebaseFlow", ["--firebase"]], ["reload", ["--firebase"]], ["race", ["--firebase"]], ["raceWrite", ["--firebase"]],
];
const TIMEZONES = ["America/Bogota", "Europe/Madrid"];

function ensureReference(dir) {
  if (dir) return { dir, cleanup: () => {} };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "muven-ref-"));
  execFileSync("git", ["-C", repo, "worktree", "add", "--detach", tmp, "Desarrollo"], { stdio: "ignore" });
  return { dir: tmp, cleanup: () => execFileSync("git", ["-C", repo, "worktree", "remove", "--force", tmp], { stdio: "ignore" }) };
}

function run(root, scenario, flags, tz, store) {
  const args = ["--import", path.join(here, "fakes/register.mjs"), path.join(here, "run.mjs"), root, scenario, ...flags];
  if (store) args.push(`--store=${store}`);
  const out = execFileSync(process.execPath, args, { env: { ...process.env, TZ: tz }, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  return JSON.parse(out);
}

function runAll(root, tz) {
  const results = {};
  for (const [name, flags, scenario = name] of RUNS) {
    if (name === "reload") {
      const store = path.join(os.tmpdir(), `muven-store-${process.pid}-${Math.random()}.json`);
      const a = run(root, "reloadA", flags, tz, store);
      const b = run(root, "reloadB", flags, tz, store);
      fs.rmSync(store, { force: true });
      results[name] = { steps: [...a.steps, ...b.steps], crash: a.crash ?? b.crash };
    } else {
      results[name] = run(root, scenario, flags, tz);
    }
  }
  return results;
}

/** El campo console se compara aparte: limpiar logs de depuración es un cambio buscado. */
const strip = ({ console: _c, ...rest }) => rest;

function firstDiff(a, b, p = "") {
  if (JSON.stringify(a) === JSON.stringify(b)) return null;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return `${p}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`;
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const d = firstDiff(a[k], b[k], `${p}.${k}`);
    if (d) return d;
  }
  return null;
}

const [refArg, candArg] = process.argv.slice(2);
const ref = ensureReference(refArg);
const candidate = candArg ?? repo;
let failures = 0;
try {
  for (const tz of TIMEZONES) {
    const before = runAll(ref.dir, tz);
    const after = runAll(candidate, tz);
    for (const name of Object.keys(before)) {
      const b = before[name], a = after[name];
      if (a.crash) { failures++; console.log(`✗ [${tz}] ${name}: el candidato falla → ${a.crash.split("\n")[0]}`); continue; }
      const stepsDiff = b.steps.map((s, i) => [s.label, firstDiff(strip(s), strip(a.steps[i] ?? {}))]).filter(([, d]) => d);
      const logsBefore = b.steps.at(-1)?.console ?? [], logsAfter = a.steps.at(-1)?.console ?? [];
      if (!stepsDiff.length) console.log(`✓ [${tz}] ${name}: ${a.steps.length} pasos idénticos`);
      else if (EXPECTED_DIFFS[name]) console.log(`≈ [${tz}] ${name}: diferencia esperada — ${EXPECTED_DIFFS[name]}\n    ${stepsDiff.map(([l, d]) => `${l}: ${d}`).join("\n    ")}`);
      else { failures++; console.log(`✗ [${tz}] ${name}: REGRESIÓN\n    ${stepsDiff.map(([l, d]) => `${l}: ${d}`).join("\n    ")}`); }
      if (JSON.stringify(logsBefore) !== JSON.stringify(logsAfter)) console.log(`    consola: ${JSON.stringify(logsBefore)} → ${JSON.stringify(logsAfter)}`);
    }
  }
} finally { ref.cleanup(); }
console.log(failures ? `\n${failures} regresión(es) sin aprobar.` : "\nSin regresiones no aprobadas.");
process.exit(failures ? 1 : 0);
