/**
 * ADAPTADOR DE FULLCALENDAR. Es el único archivo que conoce la librería.
 * FullCalendar 6.1.15 se carga por <script> en index.html y expone window.FullCalendar.
 *
 * API pública:
 *   mount(element, { onEventChanged, onDateSelected }) Crea el calendario. onEventChanged({id, start, end}) puede ser async;
 *                                      si lanza un error, el evento vuelve a su posición.
 *   render(tasks)                      Dibuja las tareas como eventos (reemplaza los anteriores)
 */
import { taskToEvent, eventToBlock } from "./calendar.mapper.js";

export function createCalendarView() {
  let calendar = null;

  function mount(element, { onEventChanged, onDateSelected }) {
    const { Calendar } = window.FullCalendar ?? {};
    if (!Calendar) throw new Error("FullCalendar no se cargó. Revisa tu conexión a internet.");
    console.log(window.innerWidth);
    calendar = new Calendar(element, {
      initialView: window.innerWidth < 600 ? "timeGridDay" : "timeGridWeek", // móvil: un día
      headerToolbar: { left: "prev,next today", center: "title", right: "timeGridWeek,timeGridDays" },
      locale: "es",
      firstDay: 2,
      allDaySlot: false,
      nowIndicator: true,
      height: "auto",
      slotMinTime: "00:00:00",
      slotMaxTime: "24:00:00",
      editable: true,              // permite arrastrar eventos
      eventDurationEditable: true, // permite ajustar la duración desde el borde inferior
      eventLongPressDelay: 300,     // en móvil, mantener pulsado para arrastrar
      selectable: true,
      selectMirror: true,
      revertEdits: true, // si falla un cambio, el evento vuelve a su posición|
      revertDuration: "0.5s", // animación de reversión
      revertEasing: "ease-in-out",
    
      select: (info) => {
        onDateSelected({ start: info.start , end: info.end });
        calendar.unselect();
      },
      eventDrop: saveEventChange,
      eventResize: saveEventChange,
    });
    calendar.render();

    async function saveEventChange(info) {
      try {
        await onEventChanged({ id: info.event.id, ...eventToBlock(info.event, info.oldEvent) });
      } catch {
        info.revert(); // si falla, el evento vuelve a su sitio
      }
    }
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
