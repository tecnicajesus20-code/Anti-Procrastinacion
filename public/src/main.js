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

// Asegúrate de tener tus variables de categorías y tareas sincronizadas con tu app
let categoriasUsuario = ['Hogar', 'Trabajo', 'Estudio', 'Diversión/Entretenimiento', 'Familia', 'Ocio'];

/**
 * Elimina una categoría de forma segura garantizando que las tareas 
 * asociadas NO desaparezcan bajo ninguna circunstancia (Regla crucial).
 * @param {string} categoriaAEliminar - Nombre de la categoría a borrar.
 */
function eliminarCategoriaSegura(categoriaAEliminar) {
  const categoriaPorDefecto = 'Ocio'; // Categoría por defecto para espacios sin asignar

  if (categoriaAEliminar === categoriaPorDefecto) {
    showMessage("No se puede eliminar la categoría por defecto (Ocio).", "error");
    return;
  }

  if (typeof tareas !== 'undefined') {
    tareas = tareas.map(function(tarea) {
      if (tarea.categoria === categoriaAEliminar) {
        return Object.assign({}, tarea, { categoria: categoriaPorDefecto });
      }
      return tarea;
    });
  }

  categoriasUsuario = categoriasUsuario.filter(function(cat) {
    return cat !== categoriaAEliminar;
  });

  console.log(`Categoría "${categoriaAEliminar}" eliminada. Las tareas pasaron a "${categoriaPorDefecto}".`);
}

/**
 * Devuelve la clase CSS correspondiente al estado visual de la tarea
 * @param {string} estado - Puede ser 'completada', 'incumplida' o 'pendiente'
 */
function obtenerClaseEstadoVisual(estado) {
  if (estado === 'completada') return 'tarea-completada';
  if (estado === 'incumplida') return 'tarea-incumplida';
  return 'tarea-pendiente';
}

// Función auxiliar para mostrar el error flotante y ocultarlo automáticamente a los 4 segundos
function mostrarErrorFlotante(mensaje) {
  showMessage(mensaje, "error");
  const messageEl = document.getElementById('message');
  if (messageEl) {
    messageEl.hidden = false;
    messageEl.classList.add('error');
    
    // Limpiar temporizador anterior si existía para evitar conflictos
    if (window._errorTimeout) clearTimeout(window._errorTimeout);
    
    window._errorTimeout = setTimeout(() => {
      messageEl.hidden = true;
      messageEl.classList.remove('error');
    }, 4000);
  }
}

// Definición de límites máximos permitidos para cada nivel
const difficultyLimits = {
  "1": { max: 30, name: "Nivel 1: Fácil · Rápida (Máx. 30 min)" },
  "2": { max: 60, name: "Nivel 2: Moderada · Ligera (Máx. 60 min)" },
  "3": { max: 90, name: "Nivel 3: Intermedia · Concentración (Máx. 90 min)" },
  "4": { max: 120, name: "Nivel 4: Desafío (Máx. 120 min)" },
  "5": { max: Infinity, name: "Nivel 5: Hardcore (Sin límite)" }
};

function validarDuracionEstricta(startStr, endStr, difficultyLevel) {
  const startDate = new Date(startStr);
  const endDate = new Date(endStr);
  
  const diffMs = endDate - startDate;
  const diffMins = Math.round(diffMs / (1000 * 60));

  if (diffMins <= 0) {
    mostrarErrorFlotante("❌ La fecha de fin debe ser posterior a la de inicio.");
    return false;
  }

  const limit = difficultyLimits[difficultyLevel];
  if (!limit) {
    mostrarErrorFlotante("⚠️ Por favor selecciona un nivel de dificultad obligatorio.");
    return false;
  }

  if (diffMins > limit.max) {
    mostrarErrorFlotante(`⛔ No permitido: La duración seleccionada (${diffMins} min) excede el tiempo máximo permitido para el ${limit.name}.`);
    return false;
  }

  return true;
}

const eventForm = document.getElementById('event-form');

if (eventForm) {
  // Ocultar mensaje automáticamente al escribir o interactuar en el formulario
  eventForm.addEventListener('input', () => {
    const messageEl = document.getElementById('message');
    if (messageEl) {
      messageEl.hidden = true;
      messageEl.classList.remove('error');
    }
  });

  // Interceptar el envío del formulario para bloquear si la duración excede el nivel
  eventForm.addEventListener('submit', (e) => {
    const start = document.getElementById('event-start').value;
    const end = document.getElementById('event-end').value;
    const category = document.getElementById('event-category').value;

    if (!validarDuracionEstricta(start, end, category)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      e.stopPropagation();
      return false;
    }
  }, true);
}