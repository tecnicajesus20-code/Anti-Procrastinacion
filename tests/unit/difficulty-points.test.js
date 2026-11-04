import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DIFFICULTIES, allowedDifficulties, isDifficultyAllowed, validateBlockDifficulty, pointsForBlock, penaltyForBlock,
} from "../../public/src/domain/difficulty.js";
import {
  buildBlockOutcome, validateBlockOutcome, validateFocusIntent, usesBlockScoring, allBlocksCompleted, isAwaitingAnswer,
} from "../../public/src/domain/block-outcome.js";

const block = (minutes, difficulty) => ({
  start: "2026-11-02T10:00:00.000Z",
  end: new Date(Date.parse("2026-11-02T10:00:00.000Z") + minutes * 60_000).toISOString(),
  ...(difficulty ? { difficulty } : {}),
});

test("niveles, límites y multiplicadores según la especificación", () => {
  assert.deepEqual(DIFFICULTIES.map((d) => [d.id, d.maxMinutes, d.multiplier]), [
    ["facil", 30, 1], ["moderada", 45, 2], ["intermedia", 60, 3], ["desafio", 120, 4], ["hardcore", null, 5],
  ]);
});

test("las dificultades incompatibles con la duración quedan fuera (límite inclusive)", () => {
  assert.deepEqual(allowedDifficulties(30).map((d) => d.id), ["facil", "moderada", "intermedia", "desafio", "hardcore"]);
  assert.deepEqual(allowedDifficulties(31).map((d) => d.id), ["moderada", "intermedia", "desafio", "hardcore"]);
  assert.deepEqual(allowedDifficulties(61).map((d) => d.id), ["desafio", "hardcore"]);
  assert.deepEqual(allowedDifficulties(500).map((d) => d.id), ["hardcore"]);
  assert.equal(isDifficultyAllowed("facil", 0), false);
  assert.equal(isDifficultyAllowed("x", 10), false);
});

test("validateBlockDifficulty: sin dificultad es válido; excedido o desconocido no", () => {
  assert.equal(validateBlockDifficulty(block(90)), null);
  assert.equal(validateBlockDifficulty(block(45, "moderada")), null);
  assert.equal(validateBlockDifficulty(block(46, "moderada")), "La dificultad Moderada permite bloques de hasta 45 minutos.");
  assert.equal(validateBlockDifficulty(block(10, "x")), "La dificultad del bloque no es válida.");
  // Fin anterior al inicio: lo informa validateTask; aquí no se añade un segundo mensaje confuso.
  assert.equal(validateBlockDifficulty(block(-30, "hardcore")), null);
  assert.equal(validateBlockDifficulty(block(-30, "facil")), null);
});

test("puntos = multiplicador × minutos/15, redondeado, mínimo 1; penalización 1,5×", () => {
  assert.equal(pointsForBlock(block(30, "facil")), 2);
  assert.equal(pointsForBlock(block(5, "facil")), 1); // 0,33 → mínimo 1
  assert.equal(pointsForBlock(block(45, "moderada")), 6);
  assert.equal(pointsForBlock(block(60, "intermedia")), 12);
  assert.equal(pointsForBlock(block(120, "desafio")), 32);
  assert.equal(pointsForBlock(block(180, "hardcore")), 60);
  assert.equal(pointsForBlock(block(25, "intermedia")), 5); // 3 × 1,67 = 5
  assert.equal(pointsForBlock(block(60)), 0); // tarea antigua: no suma
  assert.equal(penaltyForBlock(block(30, "facil")), 3);
  assert.equal(penaltyForBlock(block(5, "facil")), 2); // 1 × 1,5 = 1,5 → 2
  assert.equal(penaltyForBlock(block(60, "intermedia")), 18);
  assert.equal(penaltyForBlock(block(60)), 0);
});

test("buildBlockOutcome guarda puntos positivos o negativos y es válido", () => {
  const now = new Date("2026-11-02T11:00:00.000Z");
  const done = buildBlockOutcome(block(60, "intermedia"), "completed", { now });
  assert.deepEqual(done, { status: "completed", points: 12, resolvedAt: now.toISOString(), source: "user" });
  const failed = buildBlockOutcome(block(60, "intermedia"), "not_completed", { now, source: "timeout" });
  assert.deepEqual(failed, { status: "not_completed", points: -18, resolvedAt: now.toISOString(), source: "timeout" });
  assert.equal(buildBlockOutcome(block(60), "not_completed", { now }).points, 0);
  assert.ok(!Object.is(buildBlockOutcome(block(60), "not_completed", { now }).points, -0));
  assert.equal(validateBlockOutcome(done), null);
  assert.equal(validateBlockOutcome(undefined), null);
  assert.equal(validateBlockOutcome({ ...done, points: 1.5 }), "El resultado del bloque no es válido.");
  assert.throws(() => buildBlockOutcome(block(10, "facil"), "maybe", { now }));
});

test("intención del bloque: texto no vacío y con límite", () => {
  assert.equal(validateFocusIntent(undefined), null);
  assert.equal(validateFocusIntent("Resolver ejercicios 1 a 5"), null);
  assert.ok(validateFocusIntent("   "));
  assert.ok(validateFocusIntent("x".repeat(201)));
});

test("estado de la tarea por bloques y bloques pendientes de respuesta", () => {
  const legacy = { start: "2026-11-02T10:00:00.000Z", end: "2026-11-02T11:00:00.000Z" };
  assert.equal(usesBlockScoring(legacy), false);
  const b1 = block(30, "facil");
  const b2 = { ...block(30, "facil"), start: "2026-11-02T12:00:00.000Z", end: "2026-11-02T12:30:00.000Z" };
  const task = { start: b1.start, end: b1.end, blocks: [b1, b2] };
  assert.equal(usesBlockScoring(task), true);
  assert.equal(allBlocksCompleted(task), false);
  const outcome = { status: "completed", points: 2, resolvedAt: "2026-11-02T13:00:00.000Z", source: "user" };
  assert.equal(allBlocksCompleted({ ...task, blocks: [{ ...b1, outcome }, b2] }), false);
  assert.equal(allBlocksCompleted({ ...task, blocks: [{ ...b1, outcome }, { ...b2, outcome }] }), true);
  const now = Date.parse("2026-11-02T12:10:00.000Z");
  assert.equal(isAwaitingAnswer(b1, now), true);
  assert.equal(isAwaitingAnswer(b2, now), false); // aún no termina
  assert.equal(isAwaitingAnswer({ ...b1, outcome }, now), false);
  assert.equal(isAwaitingAnswer(legacy, now), false); // sin dificultad: nunca pendiente
});
