/**
 * Tarjetas de la portada que rotan entre varias funciones de la app (solo apariencia).
 * Cada .feat tiene varias .feat__face; cada pocos segundos pasa a la siguiente, con un
 * desfase entre tarjetas. Se pausa al pasar el mouse o al enfocar una tarjeta, y cuando la pestaña no se ve.
 */
const INTERVAL_MS = 4500;
const STAGGER_MS = 600;
const LEAVE_MS = 500;

export function initLandingFeats(root = document.getElementById("landing-feats")) {
  if (!root) return;
  const cards = [...root.querySelectorAll(".feat")];

  cards.forEach((card, cardIndex) => {
    const faces = [...card.querySelectorAll(".feat__face")];
    const dots = [...card.querySelectorAll(".feat__dots i")];
    if (faces.length < 2) return;
    let current = 0;
    let paused = false;

    const show = (next) => {
      const leaving = faces[current];
      leaving.classList.remove("is-active");
      leaving.classList.add("is-leaving");
      leaving.setAttribute("aria-hidden", "true");
      setTimeout(() => leaving.classList.remove("is-leaving"), LEAVE_MS);
      faces[next].classList.add("is-active");
      faces[next].removeAttribute("aria-hidden");
      dots.forEach((dot, i) => dot.classList.toggle("is-active", i === next));
      current = next;
    };

    const tick = () => {
      if (!paused && !document.hidden && root.offsetParent !== null) show((current + 1) % faces.length);
    };

    card.addEventListener("mouseenter", () => { paused = true; });
    card.addEventListener("mouseleave", () => { paused = false; });
    card.addEventListener("focusin", () => { paused = true; });
    card.addEventListener("focusout", () => { paused = false; });

    setTimeout(() => setInterval(tick, INTERVAL_MS), cardIndex * STAGGER_MS);
  });
}
