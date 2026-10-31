/**
 * PUNTO DE ENTRADA Y RAÍZ DE COMPOSICIÓN. Aquí (y solo aquí) se crean los módulos y se conectan.
 * index.html carga este archivo; no cambiar su ruta sin actualizar index.html.
 *
 *   presentación ──acciones──▶ application (casos de uso) ──contrato──▶ infrastructure (memoria / Firestore)
 *   application ──subscribe──▶ presentación (lista y calendario se redibujan)
 *   firebase-auth ──sesión──▶ session.coordinator ──▶ task.service.useRepository(...)
 *
 * Orden de arranque (se conserva tal cual): vistas de tareas → calendario → Pomodoro → cuenta →
 * carga demo → escucha de sesión. Si FullCalendar no carga, se muestra el error y no sigue.
 */
import { byId } from "./shared/dom.js";
import { setLoading, showMessage } from "./shared/feedback.js";

import { createTaskService } from "./application/task.service.js";
import { createSessionCoordinator } from "./application/session.coordinator.js";
import { createPomodoroService } from "./application/pomodoro.service.js";

import { createFirebaseAuth } from "./infrastructure/firebase/firebase-auth.js";
import { createFirestoreTaskRepository } from "./infrastructure/firebase/task.firestore.repository.js";
import { createMemoryTaskRepository } from "./infrastructure/memory/task.memory.repository.js";
import { buildSeedTasks } from "./infrastructure/memory/demo-tasks.js";

import { initTaskForm } from "./presentation/tasks/task-form.ui.js";
import { initCalendarTaskDialog } from "./presentation/tasks/calendar-task-dialog.ui.js";
import { initTaskList } from "./presentation/tasks/task-list.view.js";
import { createCalendarView } from "./presentation/calendar/calendar.view.js";
import { initPomodoroUi } from "./presentation/pomodoro/pomodoro.ui.js";
import { initAuthUi } from "./presentation/auth/auth.ui.js";

const auth = createFirebaseAuth();
const createDemoRepository = () => createMemoryTaskRepository(buildSeedTasks());

/** Conecta la sesión con el repositorio de tareas. Si Firebase no está configurado, se queda en modo demo. */
async function connectSession(authUi, taskService) {
  const session = createSessionCoordinator({
    auth,
    taskService,
    createUserRepository: (uid) => createFirestoreTaskRepository(uid),
    createGuestRepository: createDemoRepository,
    onUserChanged: authUi.setUser,
    onLoadingChange: setLoading,
    onLoadError: (error) => showMessage(`No se pudieron cargar las tareas: ${error.message}`, "error"),
  });
  try {
    await session.start();
  } catch (error) {
    authUi.disable(error.message);
  }
}

async function startApp() {
  setLoading(true);
  try {
    const taskService = createTaskService(createDemoRepository());
    const calendar = createCalendarView();

    initTaskForm(taskService);
    const calendarDialog = initCalendarTaskDialog(taskService);
    initTaskList(taskService);

    calendar.mount(byId("calendar"), {
      onDateSelected: calendarDialog.open,
      // Al mover o redimensionar, el caso de uso actualiza el bloque y el calendario se redibuja.
      onEventChanged: async ({ id, start, end }) => {
        try {
          await taskService.moveBlock(id, start, end);
        } catch (error) {
          showMessage(error.message, "error");
          throw error; // el calendario devuelve el evento a su sitio
        }
      },
    });

    taskService.subscribe(calendar.render);
    initPomodoroUi(createPomodoroService());
    const authUi = initAuthUi(auth);

    await taskService.load();
    setLoading(false);
    connectSession(authUi, taskService);
  } catch (error) {
    setLoading(false);
    showMessage(error.message, "error");
  }
}

startApp();
