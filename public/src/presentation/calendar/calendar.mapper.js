import { MS_PER_HOUR, dateToIso } from "../../shared/date-time.js";
import { getTaskBlocks } from "../../domain/task.js";
import { planPomodoroTask } from "../../domain/pomodoro.js";
import { getTaskColor } from "../tasks/task-color.js";

/**
 * Traduce entre el contrato de Task y los eventos de FullCalendar.
 * Es la ÚNICA frontera de formatos: el calendario no guarda datos propios.
 */

/**
 * Task → eventos de FullCalendar (uno por cada bloque).
 * La clase event--<estado> permite dar estilo por estado (ver README_PROVISIONAL_DISENO.md, D-04).
 */
export function taskToEvents(task) {
  const color = getTaskColor(task.id);
  const plan = planPomodoroTask(task);
  const plannedBlocks = new Set(
    plan.filter((slot) => slot.kind === "focus").map((slot) => slot.blockIndex)
  );
  const taskEvents = getTaskBlocks(task)
    .map((block, blockIndex) => ({ block, blockIndex }))
    .filter(({ blockIndex }) => !plannedBlocks.has(blockIndex))
    .map(({ block, blockIndex }) => ({
      id: `${task.id}:block:${blockIndex}`,
      title: task.title,
      start: block.start,
      end: block.end,
      classNames: [`event--${task.status}`],
      backgroundColor: color,
      borderColor: color,
      extendedProps: { taskId: task.id, blockIndex, kind: "task" },
    }));
  const sessions = task.pomodoroSessions ?? [];
  const currentKeys = new Set(plan.filter((slot) => slot.kind === "focus").map((slot) => slot.scheduleKey));
  const sessionByKey = new Map(sessions.map((session) => [session.scheduleKey, session]));
  const pomodoroEvents = plan
    .filter((slot) => slot.kind === "focus")
    .map((slot) => {
      const rest = plan.find((candidate) => (
        candidate.kind === "break"
        && candidate.blockIndex === slot.blockIndex
        && candidate.sessionIndex === slot.sessionIndex
      ));
      const session = sessionByKey.get(slot.scheduleKey);
      return {
        id: `${task.id}:pomodoro:focus:${slot.blockIndex}:${slot.sessionIndex}`,
        title: `Enfoque · ${Math.ceil(slot.durationSeconds / 60)} min`,
        start: slot.start,
        end: rest?.end ?? slot.end,
        classNames: [
          "event--pomodoro-focus",
          ...(rest ? ["event--pomodoro-cycle-with-break"] : []),
          ...(session ? [`event--pomodoro-${session.status}`] : []),
        ],
        backgroundColor: "#237A57",
        borderColor: "#237A57",
        editable: false,
        extendedProps: {
          taskId: task.id,
          taskTitle: task.title,
          blockIndex: slot.blockIndex,
          kind: "pomodoro-focus",
          scheduleKey: slot.scheduleKey,
          focusStart: slot.start,
          focusEnd: slot.end,
          ...(rest ? { breakStart: rest.start, breakEnd: rest.end } : {}),
          ...(session ? { pomodoroSessionId: session.id } : {}),
        },
      };
    });

  const historicalEvents = sessions
    .filter((session) => !currentKeys.has(session.scheduleKey))
    .map((session) => ({
      id: `${task.id}:pomodoro:history:${session.id}`,
      title: "",
      start: session.scheduledStart,
      end: session.scheduledEnd,
      display: "background",
      classNames: ["event--pomodoro-focus", `event--pomodoro-${session.status}`],
      backgroundColor: "rgba(35, 122, 87, 0.25)",
      borderColor: "rgba(35, 122, 87, 0.25)",
      editable: false,
      extendedProps: {
        taskId: task.id,
        taskTitle: task.title,
        blockIndex: session.blockIndex,
        kind: "pomodoro-focus",
        scheduleKey: session.scheduleKey,
        focusStart: session.scheduledStart,
        focusEnd: session.scheduledEnd,
        pomodoroSessionId: session.id,
      },
    }));

  return [...taskEvents, ...pomodoroEvents, ...historicalEvents];
}

/**
 * Evento de FullCalendar → nuevo bloque horario en ISO 8601.
 * Si FullCalendar no entrega "end", se conserva la duración original.
 * @param {{start: Date, end: Date|null}} event      Evento ya movido
 * @param {{start: Date, end: Date|null}} oldEvent   Evento antes de moverlo
 * @returns {{start: string, end: string}}
 */
export function eventToBlock(event, oldEvent) {
  const duration = oldEvent.end ? oldEvent.end - oldEvent.start : MS_PER_HOUR;
  const end = event.end ?? new Date(event.start.getTime() + duration);
  return { start: dateToIso(event.start), end: dateToIso(end) };
}
