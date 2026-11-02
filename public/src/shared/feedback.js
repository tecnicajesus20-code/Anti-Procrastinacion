/** Estados de carga y mensajes de error/información visibles para el usuario. */
import { byId } from "./dom.js";

/** Muestra u oculta el indicador "Cargando…". */
export function setLoading(isLoading) {
  byId("loading").hidden = !isLoading;
}

/**
 * @param {string} text
 * @param {"info"|"error"} [type]
 */
export function showMessage(text, type = "info") {
  const element = byId("message");
  element.textContent = text;
  element.className = `message message--${type}`;
  element.hidden = false;
}

export function clearMessage() {
  byId("message").hidden = true;
}

/**
 * Ejecuta una acción del usuario y comunica el resultado.
 * Éxito: muestra `successText` o, si no hay, oculta el mensaje anterior. Error: lo muestra.
 * Nunca relanza: es el último eslabón de un evento de la interfaz.
 * @param {() => unknown|Promise<unknown>} action
 * @param {{ successText?: string, formatError?: (error: any) => string }} [options]
 */
export async function runAction(action, { successText, formatError = (error) => error.message } = {}) {
  try {
    await action();
    if (successText) showMessage(successText, "info");
    else clearMessage();
  } catch (error) {
    showMessage(formatError(error), "error");
  }
}
