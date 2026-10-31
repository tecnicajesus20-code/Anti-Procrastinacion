/**
 * CONVERSIONES DE FECHA Y HORA. Único lugar de la app que traduce entre formatos.
 *
 * Formatos que circulan:
 *   - ISO 8601 en UTC ("2026-11-02T14:00:00.000Z"): formato de almacenamiento (Task.start/end/dueDate).
 *   - Valor de <input type="datetime-local"> ("2026-11-02T09:00"): hora LOCAL del navegador, sin zona.
 *   - Date de JavaScript: lo que entrega FullCalendar.
 * Firestore guarda estas fechas como texto ISO, NO como Timestamp (ver docs/DATA_MODEL.md),
 * así que no hay conversión de Timestamp que hacer.
 */

export const MS_PER_MINUTE = 60_000;
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;

/**
 * Valor de un input datetime-local (hora local) → ISO 8601 UTC.
 * @param {string} value
 * @returns {string|null} null si el campo está vacío.
 */
export function localInputToIso(value) {
  return value ? new Date(value).toISOString() : null;
}

/**
 * Date → valor para un input datetime-local, en hora local y con precisión de minutos.
 * @param {Date} date
 * @returns {string}
 */
export function dateToLocalInputValue(date) {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * MS_PER_MINUTE);
  return shifted.toISOString().slice(0, 16);
}

/** @param {Date} date @returns {string} ISO 8601 UTC */
export const dateToIso = (date) => date.toISOString();

/**
 * ISO 8601 → texto corto local en español (ej. "4/11/26, 10:00").
 * @param {string} iso
 */
export function formatShortDateTime(iso) {
  return new Date(iso).toLocaleString("es", { dateStyle: "short", timeStyle: "short" });
}

/**
 * Segundos → "mm:ss".
 * @param {number} totalSeconds
 */
export function formatMinutesSeconds(totalSeconds) {
  const pad = (number) => String(number).padStart(2, "0");
  return `${pad(Math.floor(totalSeconds / 60))}:${pad(totalSeconds % 60)}`;
}

/**
 * Lunes a las 00:00 (hora local) de la semana de `date`.
 * @param {Date} date
 * @returns {Date}
 */
export function startOfWeekMonday(date) {
  const monday = new Date(date);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  return monday;
}
