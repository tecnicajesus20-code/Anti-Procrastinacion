/**
 * VALIDACIÓN DE LOS CAMPOS NUEVOS DE UNA TAREA (categoría y, en cada bloque, dificultad,
 * intención y resultado). Complementa a validateTask de domain/task.js sin modificarlo.
 * Solo valida un campo si existe, así las tareas guardadas antes de esta funcionalidad siguen siendo válidas.
 */
import { validateBlockDifficulty } from "./difficulty.js";
import { validateBlockOutcome, validateFocusIntent } from "./block-outcome.js";
import { validateTaskCategoryField } from "./category.js";

/**
 * @param {Partial<import("./task.js").Task>} data
 * @returns {string[]} errores (sin repetir)
 */
export function validateTaskExtensions(data) {
  const errors = [validateTaskCategoryField(data?.category)];
  if (Array.isArray(data?.blocks)) {
    data.blocks.forEach((block) => errors.push(
      validateBlockDifficulty(block),
      validateFocusIntent(block?.focusIntent),
      validateBlockOutcome(block?.outcome)
    ));
  }
  return [...new Set(errors.filter(Boolean))];
}
