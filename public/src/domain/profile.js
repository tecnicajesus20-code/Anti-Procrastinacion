export const PROFILE_LIMITS = Object.freeze({ nameMax: 50, photoMax: 100_000 });

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

export function buildProfileData(input) {
  return {
    displayName: typeof input.displayName === "string" ? input.displayName.trim() : "",
    photo: input.photo || null,
  };
}