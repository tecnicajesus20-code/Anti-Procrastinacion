/** PRESENTACIÓN DE AUTENTICACIÓN: formulario de cuenta y etiqueta de usuario. No conoce Firebase. */
import { byId } from "../../shared/dom.js";
import { runAction, showMessage } from "../../shared/feedback.js";
import { resizeImageToDataUrl } from "../../shared/image.js";
import { buildProfileData, validateProfile } from "../../domain/profile.js";



/** Los errores de Firebase traen un código (auth/...); se muestra tal cual (ver README_PROVISIONAL_DISENO.md, D-06). */
const authErrorText = (error) => error.code ?? error.message;

/** @param {ReturnType<import("../../infrastructure/firebase/firebase-auth.js").createFirebaseAuth>} authService */
export function initAuthUi(authService, profileService) {
  const email = byId("auth-email");
  const password = byId("auth-password");
  const logout = byId("auth-logout");
 const name = byId("auth-name");
   const photoInput = byId("auth-photo");
   const photoPreview = byId("auth-photo-preview");
   let photo = null; // foto elegida, ya reducida
   let currentUser = null;
   let currentProfile = null;

   function renderIdentity() {
     const label = byId("user-label");
     const avatar = byId("user-avatar");
     label.textContent = currentUser ? (currentProfile?.displayName || currentUser.email) : "Modo demo (sin sesión)";
     label.title = currentUser ? "Ver mi perfil" : "";
     if (currentUser) label.dataset.go = "perfil";
     else delete label.dataset.go;
     avatar.hidden = !currentProfile?.photo;
     if (currentProfile?.photo) avatar.src = currentProfile.photo;
   }

   photoInput.addEventListener("change", async () => {
     photo = null;
     photoPreview.hidden = true;
     const [file] = photoInput.files;
     if (!file) return;
     try {
       photo = await resizeImageToDataUrl(file);
       photoPreview.src = photo;
       photoPreview.hidden = false;
     } catch {
       showMessage("No se pudo leer la imagen.", "error");
     }
   });
  const run = (action, successText) => runAction(action, { successText, formatError: authErrorText });

  byId("auth-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const registering = event.submitter?.id === "auth-register";
    if (registering) {
       const input = { displayName: name.value, photo };
   const [problem] = validateProfile(buildProfileData(input));
   if (problem) {
     byId("auth-extra").open = true;
     showMessage(problem, "error");
     return;
   }
   profileService.setPending(input);
   run(async () => {
     try {
       await authService.register(email.value, password.value);
     } catch (error) {
       profileService.setPending(null);
       throw error;
     }
   }, "Cuenta creada.");
    } else {
      run(() => authService.login(email.value, password.value), "Sesión iniciada.");
    }
  });
  byId("auth-reset").addEventListener("click", () => run(() => authService.resetPassword(email.value), "Revisa tu correo para restablecer la contraseña."));
  logout.addEventListener("click", () => run(() => authService.logout(), "Sesión cerrada."));

  return {
    /** @param {{uid: string, email: string}|null} user */
     setUser(user) {
     currentUser = user;
     currentProfile = null;
     logout.hidden = !user;
     renderIdentity();
   },
   setProfile(profile) {
     currentProfile = profile;
     renderIdentity();
   },
    /** Desactiva el formulario y explica por qué (ej. Firebase sin configurar). */
    disable(reason) {
      byId("auth-form").querySelectorAll("input, button").forEach((control) => (control.disabled = true));
      byId("auth-note").textContent = reason;
    },
  };
}
