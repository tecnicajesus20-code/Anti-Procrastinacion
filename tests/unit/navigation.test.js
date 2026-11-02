/** Navegación entre pantallas: rutas, destino tras cambiar la sesión y coherencia con index.html. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { ROUTES, DEFAULT_ROUTE, resolveRoute, routeAfterUserChange } from "../../public/src/presentation/shell/navigation.ui.js";

const html = fs.readFileSync(new URL("../../public/index.html", import.meta.url), "utf8");
const user = { uid: "u1", email: "ana@x.com" };

test("resolveRoute: hash conocido, con o sin #", () => {
  assert.equal(resolveRoute("#calendario"), "calendario");
  assert.equal(resolveRoute("pomodoro"), "pomodoro");
});

test("resolveRoute: vacío, desconocido o propiedades heredadas llevan al inicio", () => {
  for (const hash of ["", "#", "#nada", "#constructor", "#__proto__", undefined, null]) assert.equal(resolveRoute(hash), DEFAULT_ROUTE);
});

test("routeAfterUserChange: entrar desde la pantalla de cuenta lleva a Tareas", () => {
  assert.equal(routeAfterUserChange(null, user, "cuenta"), "tareas");
});

test("routeAfterUserChange: cerrar sesión dentro de la app lleva al inicio", () => {
  for (const route of ["tareas", "calendario", "pomodoro"]) assert.equal(routeAfterUserChange(user, null, route), "inicio");
});

test("routeAfterUserChange: la sesión restaurada al cargar o un cambio fuera de lugar no mueven nada", () => {
  assert.equal(routeAfterUserChange(null, user, "inicio"), null);
  assert.equal(routeAfterUserChange(null, user, "tareas"), null);
  assert.equal(routeAfterUserChange(null, null, "cuenta"), null);
  assert.equal(routeAfterUserChange(user, null, "inicio"), null);
  assert.equal(routeAfterUserChange(user, null, "cuenta"), null);
});

test("cada data-go de index.html apunta a una ruta que existe", () => {
  const targets = [...html.matchAll(/data-go="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(targets.length >= 8, `se esperaban ≥8 botones de navegación, hay ${targets.length}`);
  assert.deepEqual(targets.filter((t) => !Object.hasOwn(ROUTES, t)), []);
});

test("las pantallas y pestañas de ROUTES existen en index.html", () => {
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  const views = { home: "view-home", auth: "view-auth", app: "view-app" };
  const panels = { tasks: "panel-tasks", calendar: "panel-calendar", pomodoro: "panel-pomodoro" };
  for (const { view, panel } of Object.values(ROUTES)) {
    assert.ok(ids.has(views[view]), `falta #${views[view]}`);
    if (panel) assert.ok(ids.has(panels[panel]), `falta #${panels[panel]}`);
  }
});
