/**
 * Traduce entre el contrato de Task y los eventos de FullCalendar.
 * Es la ÚNICA frontera de formatos: el calendario no guarda datos propios.
 */

/** Task → evento de FullCalendar */
export function taskToEvent(task) {
  return {
    id: task.id,
    title: task.title,
    start: task.start,
    end: task.end,
    classNames: [`event--${task.status}`],
  };
}

/**
 * Evento de FullCalendar → nuevo bloque horario en ISO 8601.
 * Si FullCalendar no entrega "end", se conserva la duración original.
 * @param {{start: Date, end: Date|null}} event      Evento ya movido
 * @param {{start: Date, end: Date|null}} oldEvent   Evento antes de moverlo
 * @returns {{start: string, end: string}}
 */
export function eventToBlock(event, oldEvent) {
  const duration = oldEvent.end ? oldEvent.end - oldEvent.start : 60 * 60 * 1000;
  const end = event.end ?? new Date(event.start.getTime() + duration);
  return { start: event.start.toISOString(), end: end.toISOString() };
}
