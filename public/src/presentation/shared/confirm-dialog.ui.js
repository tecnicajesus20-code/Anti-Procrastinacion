/**
 * VENTANAS DE CONFIRMACIÓN PROPIAS (solo apariencia).
 * Reemplazan window.confirm / window.prompt, que el navegador dibuja arriba con su propio estilo.
 *
 *   await confirmDialog({ title, message, confirmText, danger })  → true | false
 *   await promptDialog({ title, message, placeholder, confirmText }) → texto | null (cancelado)
 *
 * Escape, la "×" o un clic en el fondo oscuro equivalen a cancelar.
 * Se abre con showModal(): queda por encima de cualquier otra ventana abierta.
 */
let dialog = null;
let parts = null;
let resolveCurrent = null;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function build() {
  dialog = el("dialog", "alarm-dialog confirm-dialog");
  dialog.setAttribute("aria-labelledby", "confirm-dialog-title");
  dialog.setAttribute("aria-describedby", "confirm-dialog-message");

  const close = el("button", "icon-button confirm-dialog__close", "×");
  close.type = "button";
  close.setAttribute("aria-label", "Cerrar");

  const content = el("form", "alarm-dialog__content");
  content.method = "dialog";
  const icon = el("div", "confirm-dialog__icon");
  icon.setAttribute("aria-hidden", "true");
  const title = el("h2", "confirm-dialog__title");
  title.id = "confirm-dialog-title";
  const message = el("p", "confirm-dialog__message");
  message.id = "confirm-dialog-message";
  const input = el("textarea", "input confirm-dialog__input");
  input.rows = 2;
  input.maxLength = 300;
  const actions = el("div", "alarm-dialog__actions confirm-dialog__actions");
  const cancel = el("button", "btn", "Cancelar");
  cancel.type = "button";
  const accept = el("button", "btn btn--primary");
  accept.type = "submit";
  actions.append(cancel, accept);
  content.append(icon, title, message, input, actions);
  dialog.append(close, content);
  document.body.append(dialog);

  const finish = (value) => {
    const resolve = resolveCurrent;
    resolveCurrent = null;
    if (dialog.open) dialog.close();
    resolve?.(value);
  };
  content.addEventListener("submit", (event) => {
    event.preventDefault();
    finish(parts.mode === "prompt" ? input.value.trim() : true);
  });
  cancel.addEventListener("click", () => finish(parts.mode === "prompt" ? null : false));
  close.addEventListener("click", () => finish(parts.mode === "prompt" ? null : false));
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault(); // Escape
    finish(parts.mode === "prompt" ? null : false);
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) finish(parts.mode === "prompt" ? null : false); // fondo oscuro
  });

  parts = { icon, title, message, input, cancel, accept, mode: "confirm" };
}

function show({ mode, title, message = "", confirmText, cancelText = "Cancelar", danger = false, icon, placeholder = "" }) {
  if (!dialog) build();
  if (resolveCurrent) resolveCurrent(mode === "prompt" ? null : false); // una a la vez

  parts.mode = mode;
  parts.title.textContent = title;
  parts.message.textContent = message;
  parts.message.hidden = !message;
  parts.icon.textContent = icon ?? (danger ? "🗑️" : mode === "prompt" ? "✍️" : "❔");
  parts.cancel.textContent = cancelText;
  parts.accept.textContent = confirmText;
  parts.accept.className = `btn ${danger ? "btn--danger-solid" : "btn--primary"}`;
  dialog.classList.toggle("confirm-dialog--danger", danger);
  parts.input.hidden = mode !== "prompt";
  parts.input.value = "";
  parts.input.placeholder = placeholder;

  return new Promise((resolve) => {
    resolveCurrent = resolve;
    dialog.showModal();
    (mode === "prompt" ? parts.input : danger ? parts.cancel : parts.accept).focus();
  });
}

/** @returns {Promise<boolean>} */
export function confirmDialog({ title, message, confirmText = "Aceptar", cancelText, danger = false, icon } = {}) {
  return show({ mode: "confirm", title, message, confirmText, cancelText, danger, icon });
}

/** @returns {Promise<string|null>} texto escrito (puede ser "") o null si se canceló */
export function promptDialog({ title, message, placeholder, confirmText = "Aceptar", cancelText, danger = false, icon } = {}) {
  return show({ mode: "prompt", title, message, placeholder, confirmText, cancelText, danger, icon });
}
