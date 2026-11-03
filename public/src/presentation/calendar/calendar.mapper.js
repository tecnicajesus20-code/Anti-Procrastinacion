import { MS_PER_HOUR, dateToIso } from "../../shared/date-time.js";
import { getTaskBlocks } from "../../domain/task.js";
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
  return getTaskBlocks(task).map((block, blockIndex) => ({
    id: `${task.id}:block:${blockIndex}`,
    title: task.title,
    start: block.start,
    end: block.end,
    classNames: [`event--${task.status}`],
    backgroundColor: color,
    borderColor: color,
    extendedProps: { taskId: task.id, blockIndex },
  }));
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
