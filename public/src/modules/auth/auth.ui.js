/** PRESENTACIÓN DE AUTENTICACIÓN: formulario de cuenta y etiqueta de usuario. */
import { byId } from "../../ui/dom.js";
import { showMessage } from "../../ui/feedback.js";

/** @param {typeof import("./auth.service.js").authService} authService */
export function initAuthUi(authService) {
  const email = byId("auth-email");
  const password = byId("auth-password");
  const logout = byId("auth-logout");

  async function run(action, successText) {
    try {
      await action();
      showMessage(successText, "info");
    } catch (error) {
      showMessage(error.code ?? error.message, "error"); // los errores de Firebase traen un código (auth/...)
    }
  }

  // Pulsar Enter en el formulario equivale a iniciar sesión (y evita recargar la página).
  byId("auth-form").addEventListener("submit", (event) => {
    event.preventDefault();
    byId("auth-login").click();
  });
  byId("auth-login").addEventListener("click", () => run(() => authService.login(email.value, password.value), "Sesión iniciada."));
  byId("auth-register").addEventListener("click", () => run(() => authService.register(email.value, password.value), "Cuenta creada."));
  byId("auth-reset").addEventListener("click", () => run(() => authService.resetPassword(email.value), "Revisa tu correo para restablecer la contraseña."));
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
