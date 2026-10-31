/**
 * ADAPTADOR DE FULLCALENDAR. Es el único archivo que conoce la librería.
 * FullCalendar 6.1.15 se carga por <script> en index.html y expone window.FullCalendar.
 * No guarda datos ni aplica reglas de negocio: dibuja tareas y comunica acciones.
 *
 * API pública:
 *   mount(element, { onEventChanged, onDateSelected })
 *     onDateSelected({ start: Date, end: Date })  al seleccionar un hueco libre
 *     onEventChanged({ id, start, end })           al mover o redimensionar (ISO 8601). Puede ser async;
 *                                                  si lanza un error, el evento vuelve a su posición.
 *   render(tasks)  Dibuja las tareas como eventos (reemplaza los anteriores)
 */
import { taskToEvent, eventToBlock } from "./calendar.mapper.js";


export function createCalendarView() {
  let calendar = null;

  function mount(element, { onEventChanged, onDateSelected }) {
    const { Calendar } = window.FullCalendar ?? {};
    if (!Calendar) throw new Error("FullCalendar no se cargó. Revisa tu conexión a internet.");

    async function saveEventChange(info) {
      try {
        await onEventChanged({ id: info.event.id, ...eventToBlock(info.event, info.oldEvent) });
      } catch {
        info.revert(); // si falla, el evento vuelve a su sitio
      }
    }

    calendar = new Calendar(element, {
      initialView: window.innerWidth < 600 ? "timeGridDay" : "timeGridWeek", // móvil: un día
      // ⚠️ REVISIÓN PENDIENTE (ver README_PROVISIONAL_DISENO.md, D-01): "timeGridDays" no es una vista
      // de FullCalendar; el botón aparece pero no lleva a ninguna vista válida. Además, en móvil no hay
      // botón para volver a la vista de un día. Sugerencia: right: "timeGridWeek,timeGridDay".
      headerToolbar: { left: "prev,next today", center: "title", right: "timeGridWeek,timeGridDays" },
      locale: "es",
      // ⚠️ REVISIÓN PENDIENTE (D-02): 2 = martes. Las tareas demo y el resto de la app asumen semanas
      // que empiezan en lunes. Si el martes no es intencionado, la sugerencia es firstDay: 1.
      firstDay: 2,
      allDaySlot: false,
      nowIndicator: true,
      height: "auto",
      slotMinTime: "00:00:00",
      slotMaxTime: "24:00:00",
      editable: true,              // permite arrastrar eventos
      eventDurationEditable: true, // permite ajustar la duración desde el borde inferior
      eventLongPressDelay: 300,    // en móvil, mantener pulsado para arrastrar
      selectable: true,
      selectMirror: true,
      // La animación al revertir un cambio fallido es la de FullCalendar (dragRevertDuration, 500 ms por defecto).
      select: (info) => {
        onDateSelected({ start: info.start, end: info.end });
        calendar.unselect();
      },
      eventDrop: saveEventChange,
      eventResize: saveEventChange,
    });
    calendar.render();
  }

  /** @param {import("../../domain/task.js").Task[]} tasks */
  function render(tasks) {
    if (!calendar) return;
    calendar.batchRendering(() => {
      calendar.removeAllEvents();
      tasks.forEach((task) => calendar.addEvent(taskToEvent(task)));
    });
  }

  return { mount, render };
}
