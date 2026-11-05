/**
 * PERFIL · INFORMACIÓN PERSONAL: foto, nombre, correo y edición (ventana "Editar perfil").
 * El correo se muestra desde la sesión (Firebase Auth) y nunca se guarda en el perfil.
 * Guardar delega en profileService.update (valida y conserva la fecha de alta).
 */
import { byId } from "../../shared/dom.js";
import { runAction } from "../../shared/feedback.js";
import { resizeImageToDataUrl } from "../../shared/image.js";

const initialOf = (text) => (String(text ?? "").trim()[0] ?? "?").toLocaleUpperCase("es");
const formatSince = (iso) => new Date(iso).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" });

/** @param {ReturnType<import("../../application/profile.service.js").createProfileService>} profileService */
export function initProfileUi(profileService) {
  const avatar = byId("profile-avatar");
  const initial = byId("profile-initial");
  const name = byId("profile-name");
  const email = byId("profile-email");
  const since = byId("profile-since");
  const editButton = byId("profile-edit");

  const dialog = byId("profile-dialog");
  const form = byId("profile-form");
  const nameInput = byId("profile-form-name");
  const emailInput = byId("profile-form-email");
  const photoInput = byId("profile-form-photo");
  const preview = byId("profile-form-preview");
  const previewInitial = byId("profile-form-initial");
  const removePhoto = byId("profile-form-remove-photo");
  const errorBox = byId("profile-form-error");
  const saveButton = byId("profile-form-save");

  let user = null;
  let draftPhoto = null; // foto que se guardará (data URL) o null

  function showPhoto(img, fallback, photo, label) {
    img.hidden = !photo;
    if (photo) img.src = photo;
    else img.removeAttribute("src");
    fallback.hidden = Boolean(photo);
    fallback.textContent = initialOf(label);
  }

  function render(profile = profileService.getProfile()) {
    const displayName = profile?.displayName || user?.email?.split("@")[0] || "Sin nombre";
    name.textContent = displayName;
    email.textContent = user?.email ?? "";
    since.textContent = profile?.createdAt ? `Miembro desde el ${formatSince(profile.createdAt)}` : "";
    showPhoto(avatar, initial, profile?.photo, displayName);
    editButton.disabled = !user;
  }

  function renderDraft() {
    showPhoto(preview, previewInitial, draftPhoto, nameInput.value || user?.email);
    removePhoto.hidden = !draftPhoto;
  }

  function setError(text) {
    errorBox.textContent = text ?? "";
    errorBox.hidden = !text;
  }

  function open() {
    if (!user) return;
    const profile = profileService.getProfile();
    nameInput.value = profile?.displayName ?? "";
    emailInput.value = user.email ?? "";
    draftPhoto = profile?.photo ?? null;
    photoInput.value = "";
    setError(null);
    renderDraft();
    dialog.showModal();
    nameInput.focus();
  }

  photoInput.addEventListener("change", async () => {
    const [file] = photoInput.files;
    if (!file) return;
    try {
      draftPhoto = await resizeImageToDataUrl(file);
      setError(null);
    } catch {
      setError("No se pudo leer la imagen. Prueba con otra.");
    }
    renderDraft();
  });
  removePhoto.addEventListener("click", () => {
    draftPhoto = null;
    photoInput.value = "";
    renderDraft();
  });
  nameInput.addEventListener("input", renderDraft);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    setError(null);
    saveButton.disabled = true;
    runAction(async () => {
      try {
        await profileService.update({ displayName: nameInput.value, photo: draftPhoto });
        dialog.close();
      } catch (error) {
        setError(error.message);
        throw error;
      } finally {
        saveButton.disabled = false;
      }
    }, { successText: "Perfil actualizado." });
  });

  editButton.addEventListener("click", open);
  byId("profile-dialog-close").addEventListener("click", () => dialog.close());
  byId("profile-form-cancel").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close(); // clic sobre el fondo oscuro
  });

  profileService.subscribe(render);

  return {
    /** @param {{uid: string, email: string}|null} nextUser */
    setUser(nextUser) {
      user = nextUser;
      if (!user && dialog.open) dialog.close();
      render();
    },
  };
}
