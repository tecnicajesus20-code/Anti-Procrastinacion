/**
 * NAVEGACIÓN ENTRE PANTALLAS: inicio (landing) · cuenta · app con tres pestañas (Tareas, Calendario, Pomodoro).
 * Solo MUESTRA y OCULTA secciones que ya existen en index.html según el hash de la URL (#inicio, #cuenta, #tareas…).
 * No lee ni escribe tareas, no habla con Firebase y no decide reglas: las tres pantallas siguen conectadas a los
 * mismos servicios que antes, solo que ahora se ven por separado.
 *
 * Los botones de navegación se declaran en el HTML con data-go="<ruta>" (un único listener los atiende a todos).
 * Es la única excepción a "JS por ids": hay muchos botones repetidos y un id por botón no aportaría nada.
 *
 * API pública:
 *   initNavigation({ onPanelShown })  →  { setUser(user), navigate(ruta) }
 *     onPanelShown: { tasks?, calendar?, pomodoro? }  funciones que se llaman al mostrarse cada pestaña
 *                   (main.js la usa para que el calendario recalcule su tamaño: se monta con la pestaña oculta)
 *     setUser(user) informa de la sesión: activa los textos "solo visitante / solo con sesión" y lleva a
 *                   Tareas tras iniciar sesión, o al Inicio tras cerrarla.
 */
import { byId } from "../../shared/dom.js";

/** ruta (hash sin #) → pantalla y, dentro de la app, pestaña. */
export const ROUTES = Object.freeze({
  inicio: { view: "home" },
  cuenta: { view: "auth" },
  tareas: { view: "app", panel: "tasks" },
  calendario: { view: "app", panel: "calendar" },
  pomodoro: { view: "app", panel: "pomodoro" },
});

export const DEFAULT_ROUTE = "inicio";

/** Hash de la URL → nombre de ruta válido. Cualquier hash desconocido o vacío lleva al inicio. */
export function resolveRoute(hash) {
  const name = String(hash ?? "").replace(/^#/, "");
  return Object.hasOwn(ROUTES, name) ? name : DEFAULT_ROUTE;
}

/**
 * ¿A dónde llevar al usuario cuando cambia la sesión? Devuelve una ruta o null (no mover).
 *  - Entra con sesión estando en la pantalla de cuenta → Tareas.
 *  - Cierra sesión estando dentro de la app → Inicio.
 * El resto de cambios (por ejemplo, la sesión guardada que Firebase restaura al cargar) no mueven nada.
 */
export function routeAfterUserChange(previousUser, user, currentRoute) {
  if (!previousUser && user && ROUTES[currentRoute].view === "auth") return "tareas";
  if (previousUser && !user && ROUTES[currentRoute].view === "app") return "inicio";
  return null;
}

export function initNavigation({ onPanelShown = {} } = {}) {
  const views = { home: byId("view-home"), auth: byId("view-auth"), app: byId("view-app") };
  const panels = { tasks: byId("panel-tasks"), calendar: byId("panel-calendar"), pomodoro: byId("panel-pomodoro") };
  let user = null;

  const currentRoute = () => resolveRoute(window.location.hash);

  function show(routeName) {
    const { view, panel } = ROUTES[routeName];
    for (const [name, element] of Object.entries(views)) element.hidden = name !== view;
    for (const [name, element] of Object.entries(panels)) element.hidden = name !== panel;
    document.querySelectorAll(".nav-tab").forEach((tab) => tab.setAttribute("aria-current", tab.dataset.go === routeName ? "page" : "false"));
    (document.scrollingElement ?? document.documentElement).scrollTop = 0;
    if (panel) onPanelShown[panel]?.();
  }

  function navigate(routeName) {
    const route = resolveRoute(routeName);
    if (currentRoute() === route && window.location.hash === `#${route}`) show(route);
    else window.location.hash = route; // dispara "hashchange" → show()
  }

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest?.("[data-go]");
    if (trigger) navigate(trigger.dataset.go);
  });
  window.addEventListener("hashchange", () => show(currentRoute()));
  show(currentRoute());

  return {
    navigate,
    /** @param {{uid: string, email: string}|null} nextUser */
    setUser(nextUser) {
      const route = routeAfterUserChange(user, nextUser, currentRoute());
      user = nextUser;
      document.body.classList.toggle("is-signed-in", Boolean(nextUser));
      if (route) navigate(route);
    },
  };
}
