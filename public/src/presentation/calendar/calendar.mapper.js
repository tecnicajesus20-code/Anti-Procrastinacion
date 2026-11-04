import { MS_PER_HOUR, dateToIso } from "../../shared/date-time.js";
import { getTaskBlocks } from "../../domain/task.js";
import { getTaskColor } from "../tasks/task-color.js";

/** Convierte cada bloque horario en una única tarea visible en el calendario. */
export function taskToEvents(task) {
  const color = getTaskColor(task.id);
  return getTaskBlocks(task).map((block, blockIndex) => ({
    id: `${task.id}:block:${blockIndex}`,
    title: task.title,
    start: block.start,
    end: block.end,
    classNames: [`event--${task.status}`, "event--calendar-task"],
    backgroundColor: color,
    borderColor: color,
    editable: true,
    extendedProps: { taskId: task.id, blockIndex, kind: "task" },
  }));
}

/**
 * Evento de FullCalendar → nuevo bloque horario en ISO 8601.
 * Si FullCalendar no entrega "end", se conserva la duración original.
 */
export function eventToBlock(event, oldEvent) {
  const duration = oldEvent.end ? oldEvent.end - oldEvent.start : MS_PER_HOUR;
  const end = event.end ?? new Date(event.start.getTime() + duration);
  return { start: dateToIso(event.start), end: dateToIso(end) };
}
