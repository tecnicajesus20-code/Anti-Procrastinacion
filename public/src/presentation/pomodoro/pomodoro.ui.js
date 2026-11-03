/** PRESENTACIÓN DEL POMODORO: muestra el tiempo y conecta los botones. */
import { byId } from "../../shared/dom.js";
import { formatMinutesSeconds, formatShortDateTime } from "../../shared/date-time.js";
import { POMODORO_MODE, POMODORO_DEFAULTS } from "../../domain/pomodoro.js";
import { runAction } from "../../shared/feedback.js";

const MODE_LABELS = { [POMODORO_MODE.WORK]: "Trabajo", [POMODORO_MODE.BREAK]: "Descanso" };
const MODE_TOTALS = { [POMODORO_MODE.WORK]: POMODORO_DEFAULTS.workSeconds, [POMODORO_MODE.BREAK]: POMODORO_DEFAULTS.breakSeconds };

/**
 * Conecta el temporizador con sesiones de enfoque trazables y confirmación explícita del usuario.
 * @param {ReturnType<import("../../application/pomodoro.service.js").createPomodoroService>} pomodoro
 * @param {ReturnType<import("../../application/pomodoro-session.service.js").createPomodoroSessionService>} pomodoroSessions
 * @param {{navigate: (route: string) => void}} navigation
 */
export function initPomodoroUi(pomodoro, pomodoroSessions, navigation) {
  const time = byId("pomodoro-time");
  const mode = byId("pomodoro-mode");
  const card = byId("pomodoro-card");
  const ring = byId("pomodoro-ring");
  const taskLabel = byId("pomodoro-task");
  const sessionStatus = byId("pomodoro-session-status");
  const confirmButton = byId("pomodoro-confirm");
  const failButton = byId("pomodoro-fail");

  function renderSession(state = pomodoroSessions.getState()) {
    const { currentSession: session, currentTask: task } = state;
    if (!session || !task) {
      taskLabel.textContent = "Sin tarea seleccionada";
      sessionStatus.textContent = "";
      confirmButton.hidden = true;
      failButton.hidden = true;
      return;
    }

    taskLabel.textContent = `Tarea: ${task.title} · Enfoque programado: ${formatShortDateTime(session.scheduledStart)}`;
    if (session.status === "completed") {
      sessionStatus.textContent = "Sesión completada y registrada.";
      confirmButton.hidden = true;
      failButton.hidden = true;
    } else if (session.status === "unfulfilled") {
      sessionStatus.textContent = `Sesión incumplida: ${session.failureReason ?? "sin motivo indicado"}`;
      confirmButton.hidden = true;
      failButton.hidden = true;
    } else if (session.endedAt) {
      sessionStatus.textContent = "El tiempo terminó. Confirma la sesión o regístrala como incumplida.";
      confirmButton.hidden = false;
      failButton.hidden = false;
    } else {
      sessionStatus.textContent = state.timer?.running
        ? "Sesión en curso. Al terminar quedará pendiente hasta que registres el resultado."
        : "Sesión pendiente. Puedes reanudarla o registrarla como incumplida.";
      confirmButton.hidden = true;
      failButton.hidden = false;
    }
  }

  pomodoro.onTick((state) => {
    time.textContent = formatMinutesSeconds(state.remaining);
    mode.textContent = state.awaitingConfirmation ? "Confirmación pendiente" : MODE_LABELS[state.mode];

    const total = Math.max(MODE_TOTALS[state.mode], state.remaining);
    ring.style.setProperty("stroke-dashoffset", String(1 - state.remaining / total));
    card.classList.toggle("pomodoro--break", state.mode === POMODORO_MODE.BREAK);
    card.classList.toggle("pomodoro--running", state.running);
    renderSession();
  });
  pomodoroSessions.subscribe(renderSession);

  byId("pomodoro-start").addEventListener("click", () => {
    const session = pomodoroSessions.getCurrentSession();
    if (session?.status === "pending" && !session.endedAt) {
      runAction(() => pomodoroSessions.resume(session.taskId, session.id));
    } else if (!session?.endedAt) {
      pomodoro.start();
    }
  });
  byId("pomodoro-pause").addEventListener("click", () => runAction(() => pomodoroSessions.pause()));
  byId("pomodoro-reset").addEventListener("click", () => runAction(() => pomodoroSessions.reset()));

  confirmButton.addEventListener("click", () => {
    const session = pomodoroSessions.getCurrentSession();
    if (session) runAction(
      () => pomodoroSessions.confirm(session.taskId, session.id),
      "Sesión completada y registrada."
    );
  });
  failButton.addEventListener("click", () => {
    const session = pomodoroSessions.getCurrentSession();
    if (!session) return;
    const reason = window.prompt("Motivo de incumplimiento (opcional):");
    if (reason !== null) runAction(
      () => pomodoroSessions.markUnfulfilled(session.taskId, session.id, reason),
      "Sesión registrada como incumplida."
    );
  });

  return async function startPomodoroForTask(taskId, taskTitle, block, scheduleKey) {
    await pomodoroSessions.start(taskId, block, scheduleKey);
    taskLabel.textContent = `Tarea: ${taskTitle} · ${formatShortDateTime(block.start)}`;
    navigation.navigate("pomodoro");
    requestAnimationFrame(() => time.scrollIntoView({ behavior: "smooth", block: "center" }));
  };
}
