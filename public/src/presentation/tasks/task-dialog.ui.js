/**
 * VENTANA "NUEVA TAREA": solo presentación. Abre y cierra el diálogo que contiene el formulario de siempre.
 * No crea tareas ni valida: eso lo sigue haciendo task-form.ui.js → taskService.add.
 *  - Se abre con "+ Nueva tarea".
 *  - Se cierra con ×, Escape, clic fuera o cuando el formulario se limpia (form.reset() ocurre solo si la tarea se guardó).
 *  - Si hay un error, se repite dentro de la ventana (el aviso global queda tapado por el diálogo).
 */
import { byId } from "../../shared/dom.js";

export function initTaskDialog() {
  const dialog = byId("task-dialog");
  const form = byId("task-form");
  const globalMessage = byId("message");
  const dialogError = byId("task-dialog-error");

  const open = () => {
    dialogError.hidden = true;
    dialog.showModal();
    byId("task-title").focus();
  };
  const close = () => dialog.close();

  byId("task-new-open").addEventListener("click", open);
  byId("task-dialog-close").addEventListener("click", close);
  form.addEventListener("reset", () => dialog.open && close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) close(); // clic sobre el fondo oscuro
  });

  // Refleja dentro de la ventana los errores que escribe shared/feedback.js en #message.
  new MutationObserver(() => {
    const isError = !globalMessage.hidden && globalMessage.classList.contains("message--error");
    dialogError.hidden = !(dialog.open && isError);
    if (!dialogError.hidden) dialogError.textContent = globalMessage.textContent;
  }).observe(globalMessage, { attributes: true, childList: true, characterData: true, subtree: true });
}