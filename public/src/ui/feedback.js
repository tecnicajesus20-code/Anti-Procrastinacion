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
