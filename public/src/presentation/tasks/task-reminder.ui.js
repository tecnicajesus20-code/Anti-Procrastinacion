import { byId } from "../../shared/dom.js";
import { runAction, showMessage } from "../../shared/feedback.js";
import { formatShortDateTime } from "../../shared/date-time.js";

/**
 * Connects scheduled task reminders to browser notifications and the alarm decision dialog.
 * @param {(taskId: string, taskTitle: string, block: {start: string, end: string}) => Promise<void>} startPomodoro
 */
export function initTaskReminderUi(startPomodoro) {
  const enableButton = byId("notifications-enable");
  const alarmButton = byId("alarm-enable");
  const stopAlarmButton = byId("alarm-stop");
  const alarmDialog = byId("alarm-dialog");
  const alarmTask = byId("alarm-dialog-task");
  const alarmTime = byId("alarm-dialog-time");
  const doPomodoroButton = byId("alarm-do-pomodoro");
  const rejectButton = byId("alarm-reject");
  const AudioContextConstructor = window.AudioContext ?? window.webkitAudioContext;
  let audioContext = null;
  let alarmEnabled = false;
  let alarmInterval = null;
  let activeReminder = null;

  function updatePermissionButton() {
    if (!("Notification" in window)) {
      enableButton.textContent = "Avisos en pantalla";
      enableButton.disabled = true;
      enableButton.title = "Este navegador no permite notificaciones del sistema.";
    } else if (Notification.permission === "granted") {
      enableButton.textContent = "Notificaciones activadas";
      enableButton.disabled = true;
      enableButton.title = "";
    } else if (Notification.permission === "denied") {
      enableButton.textContent = "Notificaciones bloqueadas";
      enableButton.disabled = true;
      enableButton.title = "Permite las notificaciones desde la configuración del navegador.";
    } else {
      enableButton.textContent = "Activar notificaciones";
      enableButton.disabled = false;
      enableButton.title = "";
    }
  }

  enableButton.addEventListener("click", async () => {
    if (!("Notification" in window)) {
      showMessage("Este navegador no permite notificaciones del sistema. Activa la alarma sonora para oír el aviso mientras la app esté abierta.");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      updatePermissionButton();
      showMessage(permission === "granted"
        ? "Notificaciones activadas. Te avisaré cuando empiece un bloque."
        : "No se activaron las notificaciones. Los avisos aparecerán dentro de la aplicación mientras esté abierta.");
    } catch (error) {
      showMessage(`No se pudieron activar las notificaciones: ${error.message}`, "error");
    }
  });

  if (!AudioContextConstructor) {
    alarmButton.disabled = true;
    alarmButton.title = "Este navegador no permite reproducir la alarma sonora.";
  }

  function playTone(frequency, offsetSeconds) {
    if (!audioContext || audioContext.state !== "running") return;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const startsAt = audioContext.currentTime + offsetSeconds;
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, startsAt);
    gain.gain.setValueAtTime(0.0001, startsAt);
    gain.gain.exponentialRampToValueAtTime(0.22, startsAt + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, startsAt + 0.32);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(startsAt);
    oscillator.stop(startsAt + 0.34);
  }

  function playChime() {
    playTone(880, 0);
    playTone(660, 0.4);
  }

  alarmButton.addEventListener("click", async () => {
    if (!AudioContextConstructor) {
      showMessage("Este navegador no permite reproducir la alarma sonora.", "error");
      return;
    }

    try {
      audioContext ??= new AudioContextConstructor();
      await audioContext.resume();
      if (audioContext.state !== "running") {
        throw new Error("El navegador no permitió activar el sonido.");
      }

      alarmEnabled = !alarmEnabled;
      alarmButton.textContent = alarmEnabled ? "Desactivar alarma sonora" : "Activar alarma sonora";
      alarmButton.setAttribute("aria-pressed", String(alarmEnabled));
      if (alarmEnabled) {
        playChime();
        showMessage("Alarma sonora activada. Sonará cuando empiece uno de tus bloques.");
      } else {
        stopAlarm();
        showMessage("Alarma sonora desactivada.");
      }
    } catch (error) {
      showMessage(`No se pudo activar la alarma sonora: ${error.message}`, "error");
    }
  });

  function stopAlarm() {
    if (alarmInterval !== null) {
      window.clearInterval(alarmInterval);
      alarmInterval = null;
    }
    stopAlarmButton.hidden = true;
  }

  function resolveReminder() {
    if (!activeReminder) return null;
    const reminder = activeReminder;
    activeReminder = null;
    stopAlarm();
    if (alarmDialog.open) alarmDialog.close();
    return reminder;
  }

  doPomodoroButton.addEventListener("click", () => {
    const reminder = resolveReminder();
    if (reminder) runAction(() => startPomodoro(reminder.task.id, reminder.task.title, reminder.block));
  });

  rejectButton.addEventListener("click", resolveReminder);
  alarmDialog.addEventListener("cancel", (event) => event.preventDefault());

  updatePermissionButton();

  function notify(reminder) {
    const { task, block } = reminder;
    const time = formatShortDateTime(block.start);
    const body = `Tienes que hacer esta tarea: ${task.title} (${time}).`;
    activeReminder = reminder;
    alarmTask.textContent = task.title;
    alarmTime.textContent = `Horario: ${time}`;
    if (!alarmDialog.open) alarmDialog.showModal();
    showMessage(body);
    if ("Notification" in window && Notification.permission === "granted" && window.isSecureContext) {
      try {
        const notification = new Notification("¡Es hora de tu tarea!", { body, tag: `${task.id}:${block.start}` });
        notification.onclick = () => window.focus();
      } catch (error) {
        showMessage(`${body} No se pudo mostrar la notificación del sistema: ${error.message}`, "error");
      }
    }

    if (alarmEnabled && audioContext?.state === "running") {
      playChime();
      stopAlarm();
      stopAlarmButton.hidden = false;
      alarmInterval = window.setInterval(playChime, 1800);
    }
  }

  stopAlarmButton.addEventListener("click", stopAlarm);

  return { notify };
}
