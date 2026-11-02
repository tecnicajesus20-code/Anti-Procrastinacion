/** Tareas de ejemplo del modo demo (sin sesión). Se generan en la semana actual. */
import { TASK_STATUS } from "../../domain/task.js";
import { startOfWeekMonday, dateToIso } from "../../shared/date-time.js";

/** @returns {import("../../domain/task.js").Task[]} */
export function buildSeedTasks(now = new Date()) {
  const monday = startOfWeekMonday(now);

  // Devuelve [inicio, fin] ISO para un día de la semana (0 = lunes), hora y duración.
  const block = (dayOffset, hour, hours = 1) => {
    const start = new Date(monday);
    start.setDate(start.getDate() + dayOffset);
    start.setHours(hour, 0, 0, 0);
    const end = new Date(start);
    end.setHours(hour + hours);
    return { start: dateToIso(start), end: dateToIso(end) };
  };

  return [
    { id: "demo-1", title: "Estudiar para el parcial", description: "Capítulos 3 y 4", status: TASK_STATUS.PENDING, dueDate: null, ...block(0, 9, 2) },
    { id: "demo-2", title: "Entregar informe", description: null, status: TASK_STATUS.IN_PROGRESS, dueDate: null, ...block(2, 14) },
    { id: "demo-3", title: "Repasar apuntes", description: null, status: TASK_STATUS.DONE, dueDate: null, ...block(3, 10) },
  ];
}
