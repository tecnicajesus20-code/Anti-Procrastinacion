/**
 * Acceso al DOM por id. Los ids se definen en index.html y se usan SOLO desde JS;
 * los estilos usan clases. Si falta un id, el error dice cuál.
 * @param {string} id
 * @returns {HTMLElement}
 */
export function byId(id) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`No existe el elemento con id "${id}" en index.html`);
  return element;
}
