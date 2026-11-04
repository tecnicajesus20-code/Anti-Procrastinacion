import { byId } from "../../shared/dom.js";
import { showMessage } from "../../shared/feedback.js";

/** Presenta y valida el motivo obligatorio antes de registrar una sesión incumplida. */
export function initUnfulfilledDialog() {
  const dialog = byId("unfulfilled-dialog");
  const form = byId("unfulfilled-form");
  const taskLabel = byId("unfulfilled-task");
  const reasonInput = byId("unfulfilled-reason");
  const cancelButton = byId("unfulfilled-cancel");
  const submitButton = byId("unfulfilled-submit");
  let submitReason = null;

  function close() {
    dialog.close();
    form.reset();
    taskLabel.textContent = "";
    submitReason = null;
  }

  function open(taskTitle, onSubmit) {
    form.reset();
    taskLabel.textContent = taskTitle;
    submitReason = onSubmit;
    dialog.showModal();
    reasonInput.focus();
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const reason = reasonInput.value.trim();
    if (!reason) {
      reasonInput.setCustomValidity("Escribe el motivo para continuar.");
      reasonInput.reportValidity();
      return;
    }
    reasonInput.setCustomValidity("");
    if (!submitReason) return;

    submitButton.disabled = true;
    try {
      await submitReason(reason);
      close();
      showMessage("Incumplimiento registrado.", "info");
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      submitButton.disabled = false;
    }
  });

  reasonInput.addEventListener("input", () => reasonInput.setCustomValidity(""));
  cancelButton.addEventListener("click", close);
  dialog.addEventListener("close", () => {
    form.reset();
    taskLabel.textContent = "";
    submitReason = null;
    submitButton.disabled = false;
  });

  return open;
}
