/**
 * PUNTO DE ENTRADA Y RAÍZ DE COMPOSICIÓN. Aquí (y solo aquí) se crean los módulos y se conectan.
 * index.html carga este archivo; no cambiar su ruta sin actualizar index.html.
 *
 *   presentación ──acciones──▶ application (casos de uso) ──contrato──▶ infrastructure (memoria / Firestore)
 *   application ──subscribe──▶ presentación (lista y calendario se redibujan)
 *   firebase-auth ──sesión──▶ session.coordinator ──▶ task.service.useRepository(...)
 *
 * Orden de arranque (se conserva tal cual): vistas de tareas → calendario → Pomodoro → cuenta →
 * carga demo → escucha de sesión. Si FullCalendar no carga, sus funciones fallan con un aviso,
 * pero las tareas, la cuenta y el Pomodoro siguen disponibles.
 * La navegación entre pantallas (solo mostrar/ocultar) se inicia al principio, antes de las vistas de tareas.
 */
import { byId } from "./shared/dom.js";
import { runAction, setLoading, showMessage } from "./shared/feedback.js";

import { createTaskService } from "./application/task.service.js";
import { createSessionCoordinator } from "./application/session.coordinator.js";
import { createPomodoroService } from "./application/pomodoro.service.js";
import { createPomodoroSessionService } from "./application/pomodoro-session.service.js";
import { createTaskReminderService } from "./application/task-reminder.service.js";

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
import { initNavigation } from "./presentation/shell/navigation.ui.js";
import { initTaskReminderUi } from "./presentation/tasks/task-reminder.ui.js";

const auth = createFirebaseAuth();
const createDemoRepository = () => createMemoryTaskRepository(buildSeedTasks());

/** Conecta la sesión con el repositorio de tareas. Si Firebase no está configurado, se queda en modo demo. */
async function connectSession(authUi, taskService, navigation) {
  const session = createSessionCoordinator({
    auth,
    taskService,
    createUserRepository: (uid) => createFirestoreTaskRepository(uid),
    createGuestRepository: createDemoRepository,
    onUserChanged: (user) => {
      authUi.setUser(user);
      navigation.setUser(user); // solo apariencia y destino de pantalla
    },
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
    // El calendario se monta con su pestaña oculta; al mostrarla recalcula su tamaño.
    const navigation = initNavigation({ onPanelShown: { calendar: calendar.refresh } });
    const pomodoro = createPomodoroService();
    const pomodoroSessions = createPomodoroSessionService({
      taskService,
      pomodoro,
      onError: (error) => showMessage(`No se pudo guardar la sesión Pomodoro: ${error.message}`, "error"),
    });

    initTaskForm(taskService);
    const startPomodoroForTask = initPomodoroUi(pomodoro, pomodoroSessions, navigation);
    const calendarDialog = initCalendarTaskDialog(taskService, startPomodoroForTask);
    initTaskList(
      taskService,
      calendarDialog.editBlock,
      calendarDialog.editTask,
      calendarDialog.addBlockToTask,
      startPomodoroForTask,
      pomodoroSessions
    );
    const reminderUi = initTaskReminderUi(startPomodoroForTask);
    const reminders = createTaskReminderService({
      taskService,
      onReminder: reminderUi.notify,
    });
    reminders.start();

    try {
      calendar.mount(byId("calendar"), {
        onDateSelected: calendarDialog.open,
        onEventSelected: calendarDialog.openTask,
        onPomodoroEventSelected: ({ taskId, blockIndex, kind, scheduleKey }) => {
          if (kind === "pomodoro-break") {
            showMessage("Este bloque corresponde a un descanso Pomodoro de 5 minutos.");
            return;
          }
          const task = taskService.getAll().find((candidate) => candidate.id === taskId);
          const block = task && (Array.isArray(task.blocks) && task.blocks.length ? task.blocks : [task])[blockIndex];
          if (!task || !block) {
            showMessage("No se encontró la tarea del bloque Pomodoro.", "error");
            return;
          }
          runAction(() => startPomodoroForTask(task.id, task.title, block, scheduleKey));
        },
        // Al mover o redimensionar, el caso de uso actualiza el bloque y el calendario se redibuja.
        onEventChanged: async ({ id, blockIndex, start, end }) => {
          try {
            await taskService.moveBlock(id, start, end, blockIndex);
          } catch (error) {
            showMessage(error.message, "error");
            throw error; // el calendario devuelve el evento a su sitio
          }
        },
      });
    } catch (error) {
      showMessage(error.message, "error");
    }

    taskService.subscribe(calendar.render);
    const authUi = initAuthUi(auth);

    await taskService.load();
    setLoading(false);
    connectSession(authUi, taskService, navigation);
  } catch (error) {
    setLoading(false);
    showMessage(error.message, "error");
  }
}

startApp();
