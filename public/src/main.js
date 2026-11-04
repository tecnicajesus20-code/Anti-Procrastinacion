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
import { createCategoryService } from "./application/category.service.js";
import { createBlockOutcomeService } from "./application/block-outcome.service.js";
import { createBlockEndWatcher } from "./application/block-end-watcher.service.js";
import { getTaskBlocks } from "./domain/task.js";

import { createFirebaseAuth } from "./infrastructure/firebase/firebase-auth.js";
import { createFirestoreTaskRepository } from "./infrastructure/firebase/task.firestore.repository.js";
import { createMemoryTaskRepository } from "./infrastructure/memory/task.memory.repository.js";
import { buildSeedTasks } from "./infrastructure/memory/demo-tasks.js";
import { createFirestoreCategoryRepository } from "./infrastructure/firebase/category.firestore.repository.js";
import { createMemoryCategoryRepository } from "./infrastructure/memory/category.memory.repository.js";

import { initTaskForm } from "./presentation/tasks/task-form.ui.js";
import { initTaskDialog } from "./presentation/tasks/task-dialog.ui.js";
import { initCalendarTaskDialog } from "./presentation/tasks/calendar-task-dialog.ui.js";
import { initTaskList } from "./presentation/tasks/task-list.view.js";
import { createCalendarView } from "./presentation/calendar/calendar.view.js";
import { initPomodoroUi } from "./presentation/pomodoro/pomodoro.ui.js";
import { initAuthUi } from "./presentation/auth/auth.ui.js";
import { initNavigation, initBellMenu } from "./presentation/shell/navigation.ui.js";
import { initTaskReminderUi } from "./presentation/tasks/task-reminder.ui.js";
import { createProfileService } from "./application/profile.service.js";
import { createFirestoreProfileRepository } from "./infrastructure/firebase/profile.firestore.repository.js";
import { initProfileUi } from "./presentation/profile/profile.ui.js";
import { initProgressUi } from "./presentation/profile/progress.ui.js";
import { initCategoryUi } from "./presentation/tasks/category.ui.js";
import { initBlockIntentDialog } from "./presentation/tasks/block-intent.ui.js";
import { initBlockEndUi } from "./presentation/tasks/block-end.ui.js";

const auth = createFirebaseAuth();
const createDemoRepository = () => createMemoryTaskRepository(buildSeedTasks(), {
  storage: window.localStorage,
  storageKey: "antiprocrastinacion:demo-tasks:v1",
});
const createDemoCategoryRepository = () => createMemoryCategoryRepository([], {
  storage: window.localStorage,
  storageKey: "antiprocrastinacion:demo-categories:v1",
});

/** Conecta la sesión con el repositorio de tareas. Si Firebase no está configurado, se queda en modo demo. */

async function connectSession(authUi, taskService, navigation, pomodoroSessions, categoryService, profileService, profileUi) {
  const session = createSessionCoordinator({
    auth,
    taskService,
    createUserRepository: (uid) => createFirestoreTaskRepository(uid),
    createGuestRepository: createDemoRepository,
    onUserChanged: (user) => {
      authUi.setUser(user);
      navigation.setUser(user);
         profileUi.setUser(user);
       profileService
     .useRepository(user ? createFirestoreProfileRepository(user.uid) : null)
     .catch((error) => showMessage(`No se pudo cargar tu perfil: ${error.message}`, "error"));
      navigation.setUser(user); // solo apariencia y destino de pantalla
      pomodoroSessions.setStorageScope(user?.uid ?? "guest");
      // Categorías propias: misma sesión que las tareas (Firestore con sesión, demo sin ella).
      categoryService.useRepository(user ? createFirestoreCategoryRepository(user.uid) : createDemoCategoryRepository())
        .catch((error) => showMessage(`No se pudieron cargar las categorías: ${error.message}`, "error"));
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
    const onPanelShown = { calendar: calendar.refresh }; // "profile" se añade al crear el progreso
    const navigation = initNavigation({ onPanelShown });
    const pomodoro = createPomodoroService();
    const pomodoroSessions = createPomodoroSessionService({
      taskService,
      pomodoro,
      storage: window.localStorage,
      onError: (error) => showMessage(`No se pudo guardar la sesión Pomodoro: ${error.message}`, "error"),
    });

    initBellMenu(); // campana de recordatorios (solo presentación)
    initTaskForm(taskService);
    initTaskDialog(); // ventana "+ Nueva tarea" (solo presentación)
    const categoryService = createCategoryService(createDemoCategoryRepository(), { taskService });
    initCategoryUi(categoryService, ["task-category", "event-category"]);
    const blockOutcomes = createBlockOutcomeService({ taskService });
    const startPomodoroForTask = initPomodoroUi(pomodoro, pomodoroSessions, navigation);
    // Inicio de bloque: antes de arrancar se pide la tarea concreta (una vez por bloque).
    // Si se cancela, no se inicia nada. El temporizador Pomodoro no cambia.
    const askBlockIntent = initBlockIntentDialog();
    const startBlock = async (taskId, taskTitle, block, scheduleKey) => {
      const task = taskService.getAll().find((candidate) => candidate.id === taskId);
      const current = task && getTaskBlocks(task).find((candidate) => candidate.start === block?.start && candidate.end === block?.end);
      if (current && !current.focusIntent) {
        const intent = await askBlockIntent({ taskTitle, block: current });
        if (intent === null) return;
        await blockOutcomes.defineIntent(taskId, current, intent);
      }
      await startPomodoroForTask(taskId, taskTitle, block, scheduleKey);
    };
    const calendarDialog = initCalendarTaskDialog(taskService, startBlock);
    initTaskList(
      taskService,
      calendarDialog.editBlock,
      calendarDialog.editTask,
      calendarDialog.addBlockToTask,
      startBlock,
      pomodoroSessions,
      { blockOutcomes, getCategories: categoryService.getAll, subscribeCategories: categoryService.subscribe }
    );
    const reminderUi = initTaskReminderUi(startBlock);
    const reminders = createTaskReminderService({
      taskService,
      onReminder: reminderUi.notify,
    });
    reminders.start();
    // Fin de bloque: "¿Terminaste la tarea?" (3 min) → campanita → 24 h sin respuesta = no realizado.
    const blockEndUi = initBlockEndUi(blockOutcomes);
    createBlockEndWatcher({
      taskService,
      blockOutcomes,
      onPrompt: blockEndUi.prompt,
      onPendingChange: blockEndUi.renderPending,
      onError: (error) => showMessage(`No se pudo registrar un bloque sin respuesta: ${error.message}`, "error"),
    }).start();

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
          runAction(() => startBlock(task.id, task.title, block, scheduleKey));
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
    const profileService = createProfileService();
    const authUi = initAuthUi(auth, profileService);
    const profileUi = initProfileUi(profileService);
    profileService.subscribe(authUi.setProfile);
    // Perfil · Score, historial y estadísticas: se calculan de las MISMAS tareas del usuario (aisladas por UID).
    const progressUi = initProgressUi({
      taskService,
      getCategories: categoryService.getAll,
      subscribeCategories: categoryService.subscribe,
    });
    onPanelShown.profile = progressUi.refresh; // al abrir Perfil se recalcula con la hora actual

    await taskService.load();
    await categoryService.load().catch((error) => showMessage(`No se pudieron cargar las categorías: ${error.message}`, "error"));
    setLoading(false);
    connectSession(authUi, taskService, navigation, pomodoroSessions, categoryService,profileService, profileUi);
  } catch (error) {
    setLoading(false);
    showMessage(error.message, "error");
  }
}

startApp();