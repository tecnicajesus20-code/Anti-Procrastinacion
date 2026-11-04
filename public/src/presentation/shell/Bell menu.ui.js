/**
 * MENÚ DE LA CAMPANA (🔔): abre y cierra el desplegable de recordatorios de la barra superior.
 * Solo presentación: los botones de dentro (#notifications-enable, #alarm-enable, #alarm-stop) siguen siendo
 * atendidos por task-reminder.ui.js. En escritorio el menú también se abre al pasar el cursor (CSS).
 */
import { byId } from "../../shared/dom.js";

export function initBellMenu() {
  const root = byId("bell");
  const toggle = byId("bell-toggle");

  function setOpen(open) {
    root.classList.toggle("bell--open", open);
    toggle.setAttribute("aria-expanded", String(open));
  }

  toggle.addEventListener("click", (event) => {
    event.stopPropagation();
    setOpen(!root.classList.contains("bell--open"));
  });
  document.addEventListener("click", (event) => {
    if (!root.contains(event.target)) setOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && root.classList.contains("bell--open")) {
      setOpen(false);
      toggle.focus();
    }
  });
}