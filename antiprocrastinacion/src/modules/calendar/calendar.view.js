/**
 * ADAPTADOR DE FULLCALENDAR. Es el único archivo que conoce la librería.
 * FullCalendar 6.1.15 se carga por <script> en index.html y expone window.FullCalendar.
 *
 * API pública:
 *   mount(element, { onEventMoved })   Crea el calendario. onEventMoved({id, start, end}) puede ser async;
 *                                      si lanza un error, el evento vuelve a su posición.
 *   render(tasks)                      Dibuja las tareas como eventos (reemplaza los anteriores)
 */
import { taskToEvent, eventToBlock } from "./calendar.mapper.js";

export function createCalendarView() {
  let calendar = null;

  function mount(element, { onEventMoved }) {
    const { Calendar } = window.FullCalendar ?? {};
    if (!Calendar) throw new Error("FullCalendar no se cargó. Revisa tu conexión a internet.");

    calendar = new Calendar(element, {
      initialView: window.innerWidth < 600 ? "timeGridDay" : "timeGridWeek", // móvil: un día
      headerToolbar: { left: "prev,next today", center: "title", right: "timeGridWeek,timeGridDay" },
      locale: "es",
      firstDay: 1,
      allDaySlot: false,
      nowIndicator: true,
      height: "auto",
      slotMinTime: "06:00:00",
      slotMaxTime: "23:00:00",
      editable: true,              // permite arrastrar eventos
      eventDurationEditable: false, // en el MVP solo se mueve, no se redimensiona
      eventLongPressDelay: 300,     // en móvil, mantener pulsado para arrastrar
      eventDrop: async (info) => {
        try {
          // info.event.start / info.event.end son las nuevas fechas del evento
          await onEventMoved({ id: info.event.id, ...eventToBlock(info.event, info.oldEvent) });
        } catch {
          info.revert(); // si falla, el evento vuelve a su sitio
        }
      },
    });
    calendar.render();
  }

  function render(tasks) {
    if (!calendar) return;
    calendar.batchRendering(() => {
      calendar.removeAllEvents();
      tasks.forEach((task) => calendar.addEvent(taskToEvent(task)));
    });
  }

  return { mount, render };
}
