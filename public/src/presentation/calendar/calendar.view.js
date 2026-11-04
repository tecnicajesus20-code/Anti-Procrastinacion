/**
 * ADAPTADOR DE FULLCALENDAR. Es el único archivo que conoce la librería.
 * FullCalendar 6.1.15 se carga por <script> en index.html y expone window.FullCalendar.
 * No guarda datos ni aplica reglas de negocio: dibuja tareas y comunica acciones.
 *
 * API pública:
 *   mount(element, { onEventChanged, onDateSelected, onEventSelected })
 *     onDateSelected({ start: Date, end: Date })  al seleccionar un hueco libre
 *     onEventSelected({ taskId, blockIndex })      al hacer clic en un bloque existente
 *     onEventChanged({ id, blockIndex, start, end }) al mover o redimensionar (ISO 8601). Puede ser async;
 *                                                  si lanza un error, el evento vuelve a su posición.
 *   render(tasks)  Dibuja las tareas como eventos (reemplaza los anteriores)
 *   refresh()      Recalcula el tamaño. Hace falta al mostrar la pestaña Calendario: se monta mientras está oculta
 */
import { taskToEvents, eventToBlock } from "./calendar.mapper.js";


export function createCalendarView() {
  let calendar = null;

  function mount(element, { onEventChanged, onDateSelected, onEventSelected }) {
    const { Calendar } = window.FullCalendar ?? {};
    if (!Calendar) throw new Error("FullCalendar no se cargó. Revisa tu conexión a internet.");

    async function saveEventChange(info) {
      try {
        await onEventChanged({
          id: info.event.extendedProps.taskId,
          blockIndex: info.event.extendedProps.blockIndex,
          ...eventToBlock(info.event, info.oldEvent),
        });
      } catch {
        info.revert(); // si falla, el evento vuelve a su sitio
      }
    }

    calendar = new Calendar(element, {
      initialView: window.innerWidth < 600 ? "timeGridDay" : "timeGridWeek", // móvil: un día
      headerToolbar: { left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay" },
      buttonText: { today: "Hoy", month: "Mes", week: "Semana", day: "Día" },
      locale: "es",
      eventTimeFormat: { hour: "2-digit", minute: "2-digit", hour12: false },
      firstDay: 2,
      allDaySlot: false,
      nowIndicator: true,
      height: "auto",
      slotMinTime: "00:00:00",
      slotMaxTime: "24:00:00",
      snapDuration: "00:05:00",
      editable: true,              // permite arrastrar eventos
      eventDurationEditable: true, // permite ajustar la duración desde el borde inferior
      eventResizableFromStart: false,
      eventLongPressDelay: 300,    // en móvil, mantener pulsado para arrastrar
      selectable: true,
      selectMirror: true,
      // La animación al revertir un cambio fallido es la de FullCalendar (dragRevertDuration, 500 ms por defecto).
      select: (info) => {
        onDateSelected({ start: info.start, end: info.end });
        calendar.unselect();
      },
      eventClick: (info) => {
        if (info.jsEvent.target instanceof Element
          && info.jsEvent.target.closest(".fc-event-resizer")) return;
        const props = info.event.extendedProps;
        onEventSelected({ taskId: props.taskId, blockIndex: props.blockIndex });
      },
      eventContent: (info) => {
        const frame = document.createElement("div");
        frame.className = "fc-event-main-frame";
        const time = document.createElement("div");
        time.className = "calendar-event-time";
        time.textContent = info.timeText;
        const titleContainer = document.createElement("div");
        titleContainer.className = "fc-event-title-container";
        const title = document.createElement("div");
        title.className = "fc-event-title";
        title.textContent = info.event.title;
        titleContainer.append(title);
        frame.append(time);
        frame.append(titleContainer);
        return { domNodes: [frame] };
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
      tasks.forEach((task) => taskToEvents(task).forEach((event) => calendar.addEvent(event)));
    });
  }

  /** Solo apariencia: FullCalendar mide su contenedor, y oculto mide 0. No cambia datos ni opciones. */
  function refresh() {
    calendar?.updateSize();
  }

  return { mount, render, refresh };
}
