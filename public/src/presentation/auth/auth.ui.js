/** PRESENTACIÓN DE AUTENTICACIÓN: formulario de cuenta y etiqueta de usuario. No conoce Firebase. */
import { byId } from "../../shared/dom.js";
import { runAction } from "../../shared/feedback.js";

/** Convierte errores frecuentes de Firebase en mensajes accionables para la interfaz. */
const authErrorText = (error) => ({
  "auth/invalid-credential": "Correo o contraseña incorrectos.",
  "auth/invalid-email": "Escribe un correo válido.",
  "auth/email-already-in-use": "Ese correo ya tiene una cuenta.",
  "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
  "auth/operation-not-allowed": "El acceso con correo y contraseña no está habilitado en Firebase.",
  "auth/too-many-requests": "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.",
  "auth/network-request-failed": "No se pudo conectar con Firebase. Comprueba tu conexión.",
  "auth/missing-email": "Escribe tu correo arriba y vuelve a pulsar «Recuperar contraseña».",
  "auth/user-not-found": "No hay ninguna cuenta con ese correo.",
}[error.code] ?? error.message ?? "No se pudo completar la autenticación.");

/** @param {ReturnType<import("../../infrastructure/firebase/firebase-auth.js").createFirebaseAuth>} authService */
export function initAuthUi(authService) {
  const email = byId("auth-email");
  const password = byId("auth-password");
  const logout = byId("auth-logout");

  const run = (action, successText) => runAction(action, { successText, formatError: authErrorText });

  byId("auth-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const registering = event.submitter?.id === "auth-register";
    if (registering) {
      run(() => authService.register(email.value, password.value), "Cuenta creada.");
    } else {
      run(() => authService.login(email.value, password.value), "Sesión iniciada.");
    }
  });
  // Recuperar contraseña: si el envío sale bien, el aviso se muestra en una ventana flotante
  // con un botón que abre el correo (Gmail, Outlook o Yahoo según el dominio) y otro para cerrar.
  const resetDialog = byId("reset-dialog");
  const resetMail = byId("reset-dialog-mail");
  const MAIL_PROVIDERS = [
    { match: /@(gmail|googlemail)\./i, url: "https://mail.google.com/", label: "Abrir Gmail" },
    { match: /@(outlook|hotmail|live|msn)\./i, url: "https://outlook.live.com/mail/", label: "Abrir Outlook" },
    { match: /@(yahoo|ymail)\./i, url: "https://mail.yahoo.com/", label: "Abrir Yahoo Mail" },
  ];
  function openResetDialog(address) {
    const provider = MAIL_PROVIDERS.find((candidate) => candidate.match.test(address)) ?? MAIL_PROVIDERS[0];
    byId("reset-dialog-email").textContent = address;
    resetMail.href = provider.url;
    resetMail.textContent = provider.label;
    resetDialog.showModal();
  }
  byId("auth-reset").addEventListener("click", () => run(async () => {
    const address = email.value.trim();
    await authService.resetPassword(address);
    openResetDialog(address);
  }));
  byId("reset-dialog-close").addEventListener("click", () => resetDialog.close());
  resetMail.addEventListener("click", () => resetDialog.close());
  resetDialog.addEventListener("click", (event) => {
    if (event.target === resetDialog) resetDialog.close(); // clic sobre el fondo oscuro
  });
  logout.addEventListener("click", () => run(() => authService.logout(), "Sesión cerrada."));

  return {
    /** @param {{uid: string, email: string}|null} user */
    setUser(user) {
      byId("user-label").textContent = user ? user.email : "Modo demo (sin sesión)";
      logout.hidden = !user;
    },
    /** Desactiva el formulario y explica por qué (ej. Firebase sin configurar). */
    disable(reason) {
      byId("auth-form").querySelectorAll("input, button").forEach((control) => (control.disabled = true));
      byId("auth-note").textContent = reason;
    },
  };
}
