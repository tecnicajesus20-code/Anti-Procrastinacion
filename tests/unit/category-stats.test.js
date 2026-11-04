import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BASE_CATEGORIES, mergeCategories, validateCategory, buildCategoryData, resolveTaskCategory, isBaseCategory, validateTaskCategoryField,
} from "../../public/src/domain/category.js";
import { weekRange, freeTimeBetweenBlocks, describeFreeTime, minutesByCategory, pointsSummary } from "../../public/src/domain/stats.js";

test("las 5 categorías base existen en orden y Ocio es una de ellas", () => {
  assert.deepEqual(BASE_CATEGORIES.map((c) => c.name), ["Hogar", "Trabajo", "Estudio", "Entretenimiento", "Ocio"]);
  assert.ok(BASE_CATEGORIES.every((c) => c.base && isBaseCategory(c.id)));
});

test("validación de categorías propias: nombre obligatorio, único (sin mayúsculas) y color válido", () => {
  const all = mergeCategories([{ id: "c1", name: "Gimnasio", color: "#112233" }]);
  assert.deepEqual(validateCategory({ name: "Lectura" }, all), []);
  assert.deepEqual(validateCategory({ name: "  " }, all), ["El nombre de la categoría es obligatorio."]);
  assert.deepEqual(validateCategory({ name: "ocio" }, all), ["Ya existe una categoría con ese nombre."]);
  assert.deepEqual(validateCategory({ name: "GIMNASIO" }, all), ["Ya existe una categoría con ese nombre."]);
  assert.deepEqual(validateCategory({ name: "x".repeat(41) }, all), ["El nombre admite hasta 40 caracteres."]);
  assert.deepEqual(validateCategory({ name: "Ok", color: "rojo" }, all), ["El color de la categoría no es válido."]);
  assert.deepEqual(buildCategoryData({ name: "  Mi   club ", color: "#ABCDEF" }), { name: "Mi club", color: "#abcdef" });
});

test("mergeCategories: base primero, propias ordenadas y nunca reemplaza una base", () => {
  const merged = mergeCategories([{ id: "b", name: "Zumba" }, { id: "a", name: "Arte" }, { id: "ocio", name: "Falsa" }]);
  assert.deepEqual(merged.map((c) => c.id), ["hogar", "trabajo", "estudio", "entretenimiento", "ocio", "a", "b"]);
  assert.equal(merged.find((c) => c.id === "ocio").name, "Ocio");
});

test("una tarea con categoría inexistente se muestra como Ocio; sin categoría → null", () => {
  const all = mergeCategories([]);
  assert.equal(resolveTaskCategory({ category: "trabajo" }, all).name, "Trabajo");
  assert.equal(resolveTaskCategory({ category: "borrada" }, all).id, "ocio");
  assert.equal(resolveTaskCategory({}, all), null);
  assert.equal(validateTaskCategoryField(undefined), null);
  assert.ok(validateTaskCategoryField(""));
});

const at = (day, hh, mm = 0) => new Date(2026, 10, day, hh, mm).toISOString(); // noviembre 2026, hora local

test("tiempo libre = huecos entre el primer y el último bloque de cada día", () => {
  const tasks = [
    { start: at(2, 8), end: at(2, 9), blocks: [{ start: at(2, 8), end: at(2, 9) }, { start: at(2, 14), end: at(2, 15) }] },
    { start: at(2, 10), end: at(2, 11) },
    { start: at(2, 10, 30), end: at(2, 11, 30) }, // se solapa: no cuenta doble
    { start: at(4, 9), end: at(4, 10) }, // un solo bloque: 0 libre
  ];
  const range = weekRange(new Date(2026, 10, 4));
  assert.equal(range.from.getDay(), 1); // lunes
  const result = freeTimeBetweenBlocks(tasks, range);
  // Día 2: 08–15 = 7 h; ocupado 1 + 1,5 + 1 = 3,5 h → libre 3,5 h
  assert.deepEqual(result.days, [
    { date: "2026-11-02", scheduledMinutes: 210, freeMinutes: 210 },
    { date: "2026-11-04", scheduledMinutes: 60, freeMinutes: 0 },
  ]);
  assert.equal(result.totalMinutes, 210);
  assert.equal(describeFreeTime(result.totalMinutes), "Te sobran 3,5 horas esta semana");
  assert.equal(describeFreeTime(300), "Te sobran 5 horas esta semana");
  assert.equal(describeFreeTime(60), "Te sobra 1 hora esta semana");
  assert.equal(describeFreeTime(0), "No te sobra tiempo entre tus bloques esta semana");
});

test("tiempo libre: no crea bloques ni modifica las tareas; fuera del rango no cuenta", () => {
  const tasks = [{ start: at(20, 8), end: at(20, 9), blocks: [{ start: at(20, 8), end: at(20, 9) }, { start: at(20, 12), end: at(20, 13) }] }];
  const snapshot = JSON.stringify(tasks);
  assert.equal(freeTimeBetweenBlocks(tasks, weekRange(new Date(2026, 10, 4))).totalMinutes, 0);
  assert.equal(freeTimeBetweenBlocks(tasks, weekRange(new Date(2026, 10, 20))).totalMinutes, 180);
  assert.equal(JSON.stringify(tasks), snapshot);
});

test("minutos por categoría y resumen de puntos a partir de los bloques", () => {
  const outcome = (status, points) => ({ status, points, resolvedAt: at(2, 23), source: "user" });
  const tasks = [
    { category: "estudio", start: at(2, 8), end: at(2, 9), blocks: [
      { start: at(2, 8), end: at(2, 9), difficulty: "intermedia", outcome: outcome("completed", 12) },
      { start: at(3, 8), end: at(3, 8, 30), difficulty: "facil", outcome: outcome("not_completed", -3) },
    ] },
    { start: at(2, 10), end: at(2, 10, 45) },
  ];
  const range = weekRange(new Date(2026, 10, 2));
  assert.deepEqual(minutesByCategory(tasks, range), { estudio: 90, sin_categoria: 45 });
  assert.deepEqual(pointsSummary(tasks), { earned: 12, lost: 3, net: 9, completedBlocks: 1, failedBlocks: 1 });
});
