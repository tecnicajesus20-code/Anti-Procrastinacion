/**
 * SELECTOR DE DIFICULTAD DE UN BLOQUE: dibuja los 5 niveles y deshabilita los que no admiten
 * la duración elegida entre los campos Inicio y Fin. Solo presentación: la regla vive en domain/difficulty.js
 * y el caso de uso vuelve a validarla al guardar.
 */
import { byId } from "../../shared/dom.js";
import { localInputToIso } from "../../shared/date-time.js";
import { DIFFICULTIES, isDifficultyAllowed, pointsForBlock, penaltyForBlock } from "../../domain/difficulty.js";

export const difficultyLabel = (difficulty) => `${difficulty.icon} ${difficulty.label}`;

/**
 * @param {{ select: string, start: string, end: string, hint: string }} ids
 * @returns {{ sync: () => void, value: () => string, setValue: (id: string|undefined) => void }}
 */
export function initDifficultySelect(ids) {
  const select = byId(ids.select);
  const start = byId(ids.start);
  const end = byId(ids.end);
  const hint = byId(ids.hint);

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Selecciona la dificultad…";
  select.replaceChildren(placeholder, ...DIFFICULTIES.map((difficulty) => {
    const option = document.createElement("option");
    option.value = difficulty.id;
    option.textContent = `${difficultyLabel(difficulty)} · ${difficulty.maxMinutes ? `hasta ${difficulty.maxMinutes} min` : "sin límite"} · ×${difficulty.multiplier}`;
    return option;
  }));

  function currentBlock() {
    return { start: localInputToIso(start.value), end: localInputToIso(end.value), difficulty: select.value };
  }

  function sync() {
    const block = currentBlock();
    const minutes = (Date.parse(block.end) - Date.parse(block.start)) / 60_000;
    const known = Number.isFinite(minutes) && minutes > 0;
    for (const option of select.options) {
      if (!option.value) continue;
      option.disabled = known && !isDifficultyAllowed(option.value, minutes);
    }
    if (select.selectedOptions[0]?.disabled) select.value = "";

    if (!known) hint.textContent = "";
    else if (!select.value) hint.textContent = `Bloque de ${Math.round(minutes)} min. Los niveles que no admiten esa duración aparecen deshabilitados.`;
    else {
      const chosen = { ...block, difficulty: select.value };
      hint.textContent = `Completarlo suma ${pointsForBlock(chosen)} puntos; si no lo completas, se descuentan ${penaltyForBlock(chosen)}.`;
    }
  }

  for (const input of [start, end]) {
    input.addEventListener("input", sync);
    input.addEventListener("change", sync);
  }
  select.addEventListener("change", sync);
  select.form?.addEventListener("reset", () => setTimeout(sync, 0));

  return {
    sync,
    value: () => select.value,
    setValue(id) {
      select.value = id ?? "";
      sync();
    },
  };
}
