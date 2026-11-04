/**
 * CATEGORÍAS DE TAREAS. Sin dependencias: no conoce el DOM, Firebase ni FullCalendar.
 *
 * - Hay 5 categorías base fijas (no se guardan ni se pueden eliminar).
 * - El usuario puede crear categorías propias (se guardan por usuario) y eliminarlas.
 * - Al eliminar una categoría propia, sus tareas pasan a "Ocio".
 * - Ocio es una categoría normal: NO se aplica automáticamente al tiempo libre.
 * La tarea guarda solo el id de su categoría (task.category). Las tareas antiguas no tienen categoría.
 *
 * @typedef {Object} Category
 * @property {string} id
 * @property {string} name
 * @property {string} color   Color CSS (#rrggbb)
 * @property {string} icon    Emoji
 * @property {boolean} base   true para las 5 categorías fijas
 */

export const FALLBACK_CATEGORY_ID = "ocio";
export const CATEGORY_NAME_MAX_LENGTH = 40;
export const DEFAULT_CUSTOM_COLOR = "#7c8db5";
export const DEFAULT_CUSTOM_ICON = "🏷️";

export const BASE_CATEGORIES = Object.freeze([
  Object.freeze({ id: "hogar", name: "Hogar", color: "#e8a33d", icon: "🏠", base: true }),
  Object.freeze({ id: "trabajo", name: "Trabajo", color: "#4a7bd0", icon: "💼", base: true }),
  Object.freeze({ id: "estudio", name: "Estudio", color: "#7a5cc7", icon: "📚", base: true }),
  Object.freeze({ id: "entretenimiento", name: "Entretenimiento", color: "#d4577f", icon: "🎮", base: true }),
  Object.freeze({ id: "ocio", name: "Ocio", color: "#3aa57a", icon: "🌿", base: true }),
]);

const BASE_IDS = new Set(BASE_CATEGORIES.map((category) => category.id));

export const isBaseCategory = (id) => BASE_IDS.has(id);

const normalizeName = (name) => String(name ?? "").trim().replace(/\s+/g, " ");

/**
 * Valida los datos de una categoría propia nueva frente a las ya existentes.
 * @param {{name: string, color?: string}} data
 * @param {Category[]} existing  Todas las categorías visibles (base + propias)
 * @returns {string[]} errores
 */
export function validateCategory(data, existing = []) {
  const errors = [];
  const name = normalizeName(data?.name);
  if (!name) errors.push("El nombre de la categoría es obligatorio.");
  else if (name.length > CATEGORY_NAME_MAX_LENGTH) errors.push(`El nombre admite hasta ${CATEGORY_NAME_MAX_LENGTH} caracteres.`);
  else if (existing.some((category) => category.name.toLocaleLowerCase("es") === name.toLocaleLowerCase("es"))) {
    errors.push("Ya existe una categoría con ese nombre.");
  }
  if (data?.color !== undefined && !/^#[0-9a-f]{6}$/i.test(String(data.color))) errors.push("El color de la categoría no es válido.");
  return errors;
}

/** Normaliza lo que llega del formulario (sin id). */
export function buildCategoryData(input) {
  return {
    name: normalizeName(input?.name),
    color: /^#[0-9a-f]{6}$/i.test(String(input?.color)) ? String(input.color).toLowerCase() : DEFAULT_CUSTOM_COLOR,
  };
}

/**
 * Lista visible: primero las base, luego las propias por nombre.
 * @param {{id: string, name: string, color?: string}[]} custom
 * @returns {Category[]}
 */
export function mergeCategories(custom = []) {
  const own = custom
    .filter((category) => category && !isBaseCategory(category.id))
    .map((category) => ({
      id: category.id,
      name: category.name,
      color: category.color || DEFAULT_CUSTOM_COLOR,
      icon: DEFAULT_CUSTOM_ICON,
      base: false,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
  return [...BASE_CATEGORIES, ...own];
}

/**
 * Categoría de una tarea. Si la tarea apunta a una categoría que ya no existe, se muestra como Ocio.
 * @returns {Category|null} null si la tarea no tiene categoría (tareas antiguas)
 */
export function resolveTaskCategory(task, categories) {
  if (!task?.category) return null;
  return categories.find((category) => category.id === task.category)
    ?? categories.find((category) => category.id === FALLBACK_CATEGORY_ID)
    ?? null;
}

/** @returns {string|null} error de forma del campo task.category (no comprueba que exista). */
export function validateTaskCategoryField(category) {
  if (category === undefined || category === null) return null;
  return typeof category === "string" && category.trim() && category.length <= 64 ? null : "La categoría de la tarea no es válida.";
}
