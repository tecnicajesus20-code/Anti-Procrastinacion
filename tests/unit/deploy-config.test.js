/** Configuración de despliegue: firebase deploy debe encontrar todo lo que firebase.json declara. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("../../", import.meta.url);
const config = JSON.parse(fs.readFileSync(new URL("firebase.json", root), "utf8"));

test("firebase.json apunta a archivos que existen", () => {
  assert.ok(fs.existsSync(new URL(`${config.hosting.public}/index.html`, root)), "hosting.public/index.html");
  assert.ok(fs.existsSync(new URL(config.firestore.rules, root)), "firestore.rules");
  assert.ok(fs.existsSync(new URL(config.firestore.indexes, root)), "firestore.indexes.json");
});

test("valores de despliegue sin cambios (sitio, base de datos, ubicación)", () => {
  assert.equal(config.hosting.site, "muvenapp-antiprocrastinacion");
  assert.equal(config.firestore.database, "(default)");
  assert.equal(config.firestore.location, "nam5");
});

test("la carpeta publicada no expone reglas, documentación ni configuración local", () => {
  const published = fs.readdirSync(new URL(`${config.hosting.public}/`, root), { recursive: true }).map(String);
  assert.deepEqual(published.filter((f) => /\.(rules|md)$|firebase\.config\.js$/.test(f)), []);
});

test("reglas: aislamiento por usuario y contrato de tarea", () => {
  const rules = fs.readFileSync(new URL(config.firestore.rules, root), "utf8").replace(/\/\/.*$/gm, "");
  assert.match(rules, /match \/users\/\{uid\}\/tasks\/\{taskId\}/);
  assert.match(rules, /request\.auth\.uid == uid/);
  assert.doesNotMatch(rules, /match \/\{document=\*\*\}/, "sin regla comodín abierta");
});
