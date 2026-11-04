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

  function mount(element, { onEventChanged, onDateSelected, onEventSelected, onPomodoroEventSelected }) {
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
      // Botones de vista: Mes · Semana · Día (D-01 resuelto: antes había una vista inexistente "timeGridDays").
      headerToolbar: { left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay" },
      locale: "es",
      // Textos en español aunque el archivo de idioma de FullCalendar no llegue a cargarse.
      buttonText: { today: "Hoy", month: "Mes", week: "Semana", day: "Día", list: "Agenda" },
      buttonHints: { prev: "Anterior", next: "Siguiente", today: "Hoy", month: "Vista de mes", week: "Vista de semana", day: "Vista de día" },
      viewHint: "Vista de $0",
      navLinkHint: "Ir al $0",
      allDayText: "Todo el día",
      moreLinkText: "más",
      noEventsText: "No hay tareas para mostrar",
      weekText: "Sm",
      navLinks: true, // en la vista de mes, clic en el número del día → abre ese día
      dayMaxEvents: true, // en la vista de mes, si hay muchas tareas se agrupan en "+N más"
      eventTimeFormat: { hour: "2-digit", minute: "2-digit", hour12: false },
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
        if (info.allDay) {
          // Vista de mes: se selecciona un día entero; se propone 09:00–10:00 del primer día elegido.
          const start = new Date(info.start);
          start.setHours(9, 0, 0, 0);
          const end = new Date(start);
          end.setHours(10);
          onDateSelected({ start, end });
        } else {
          onDateSelected({ start: info.start, end: info.end });
        }
        calendar.unselect();
      },
      eventClick: (info) => {
        const props = info.event.extendedProps;
        if (props.kind?.startsWith("pomodoro-")) {
          onPomodoroEventSelected?.({
            taskId: props.taskId,
            blockIndex: props.blockIndex,
            kind: props.kind,
            scheduleKey: props.scheduleKey,
          });
          return;
        }
        onEventSelected({ taskId: props.taskId, blockIndex: props.blockIndex });
      },
      eventContent: (info) => {
        const { kind } = info.event.extendedProps;

        const frame = document.createElement("div");
        frame.className = "fc-event-main-frame";
        if (kind === "pomodoro-focus") {
          const { focusStart, focusEnd } = info.event.extendedProps;
          const formatTime = (value) => new Intl.DateTimeFormat("es", {
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23",
          }).format(new Date(value));
          const label = document.createElement("span");
          label.className = "calendar-pomodoro-label";
          label.textContent = `${formatTime(focusStart)}–${formatTime(focusEnd)}`;
          frame.append(label);
          return { domNodes: [frame] };
        }

        if (info.timeText) {
          const time = document.createElement("div");
          time.className = "fc-event-time";
          time.textContent = info.timeText;
          frame.append(time);
        }
        const titleContainer = document.createElement("div");
        titleContainer.className = "fc-event-title-container";
        const title = document.createElement("div");
        title.className = "fc-event-title";
        title.textContent = info.event.title;
        titleContainer.append(title);
        frame.append(titleContainer);
        return { domNodes: [frame] };
      },
      eventDidMount: (info) => {
        const { taskTitle, kind, focusStart, focusEnd, breakStart, breakEnd } = info.event.extendedProps;
        if (kind?.startsWith("pomodoro-")) {
          const focusLabel = `${new Date(focusStart).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}–${new Date(focusEnd).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} enfoque`;
          const breakLabel = breakStart && breakEnd
            ? ` · ${new Date(breakStart).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}–${new Date(breakEnd).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} descanso de 5 min`
            : "";
          info.el.title = `${focusLabel}${breakLabel} · ${taskTitle}`;
          info.el.setAttribute("aria-label", info.el.title);
        }
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
