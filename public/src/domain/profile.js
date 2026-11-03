/**
 * DOMINIO DEL PERFIL: contrato de datos y validación. Sin dependencias (no conoce DOM ni Firebase).
 *
 * @typedef {Object} ProfileData
 * @property {string} displayName   Obligatorio, máximo PROFILE_LIMITS.nameMax caracteres
 * @property {string|null} photo    Opcional: imagen como texto (data URL), ya reducida
 */
export const PROFILE_LIMITS = Object.freeze({ nameMax: 50, photoMax: 100_000 });

/** @returns {string[]} Lista de errores; vacía si todo está bien. */
export function validateProfile(data) {
  const errors = [];
  if (typeof data.displayName !== "string" || !data.displayName.trim()) {
    errors.push("El nombre es obligatorio.");
  } else if (data.displayName.trim().length > PROFILE_LIMITS.nameMax) {
    errors.push(`El nombre no puede superar ${PROFILE_LIMITS.nameMax} caracteres.`);
  }
  if (data.photo != null) {
    if (typeof data.photo !== "string" || !data.photo.startsWith("data:image/")) errors.push("La foto no es válida.");
    else if (data.photo.length > PROFILE_LIMITS.photoMax) errors.push("La foto es demasiado grande.");
  }
  return errors;
}

/** Normaliza lo que llega del formulario al contrato. */
export function buildProfileData(input) {
  return {
    displayName: typeof input.displayName === "string" ? input.displayName.trim() : "",
    photo: input.photo || null,
  };
}