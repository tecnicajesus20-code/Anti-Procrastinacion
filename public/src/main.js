/**
 * PUNTO DE ENTRADA. Aquí (y solo aquí) se crean los módulos y se conectan entre sí.
 *
 *   calendario --(onEventMoved)--> taskService --(subscribe)--> calendario / lista
 *   authService --(usuario)--> repositorio (Firestore con sesión, memoria sin sesión)
 */
import { byId } from "./ui/dom.js";
import { setLoading, showMessage } from "./ui/feedback.js";
import { createTaskService } from "./modules/tasks/task.service.js";
import { initTaskUi } from "./modules/tasks/task.ui.js";
import { buildSeedTasks } from "./modules/tasks/task.seed.js";
import { createCalendarView } from "./modules/calendar/calendar.view.js";
import { createPomodoroService } from "./modules/pomodoro/pomodoro.service.js";
import { initPomodoroUi } from "./modules/pomodoro/pomodoro.ui.js";
import { authService } from "./modules/auth/auth.service.js";
import { initAuthUi } from "./modules/auth/auth.ui.js";
import { createMemoryRepository } from "./modules/storage/memory.repository.js";
import { createFirestoreRepository } from "./modules/storage/firestore.repository.js";

const demoRepository = () => createMemoryRepository(buildSeedTasks());

/** Cambia el repositorio según haya sesión o no. Si Firebase no está configurado, deja el modo demo. */
async function connectAuth(authUi, taskService) {
  try {
    await authService.onAuthChange(async (user) => {
      authUi.setUser(user);
      setLoading(true);
      try {
        await taskService.useRepository(user ? createFirestoreRepository(user.uid) : demoRepository());
      } catch (error) {
        showMessage(`No se pudieron cargar las tareas: ${error.message}`, "error");
      } finally {
        setLoading(false);
      }
    });
  } catch (error) {
    authUi.disable(error.message);
  }
}

async function startApp() {
  setLoading(true);
  try {
    const taskService = createTaskService(demoRepository());
    const calendar = createCalendarView();

    calendar.mount(byId("calendar"), {
      // FullCalendar entrega el nuevo bloque; el servicio actualiza la tarea y el calendario se redibuja.
      onEventMoved: async ({ id, start, end }) => {
        try {
          await taskService.moveBlock(id, start, end);
          byId("move-log").textContent = `Evento movido\nid:     ${id}\ninicio: ${start}\nfin:    ${end}`;
        } catch (error) {
          showMessage(error.message, "error");
          throw error; // el calendario devuelve el evento a su sitio
        }
      },
    });

    taskService.subscribe(calendar.render);
    initTaskUi(taskService);
    initPomodoroUi(createPomodoroService());
    const authUi = initAuthUi(authService);

    await taskService.load();
    setLoading(false);
    connectAuth(authUi, taskService);
  } catch (error) {
    setLoading(false);
    showMessage(error.message, "error");
  }
}

startApp();
