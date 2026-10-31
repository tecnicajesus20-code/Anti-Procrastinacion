# Módulos y contratos

Rutas relativas a `public/src/`. Todas las fechas de los contratos son texto ISO 8601 UTC salvo que se indique `Date`.

## domain/

### `domain/task.js`
| Exportación | Contrato |
|---|---|
| `Task` (typedef) | `{ id, title, description: string\|null, status: "pending"\|"in_progress"\|"done", dueDate: string\|null, start, end }` |
| `TaskData` (typedef) | `Task` sin `id` |
| `TASK_STATUS` | `{ PENDING, IN_PROGRESS, DONE }` (congelado) |
| `validateTask(data)` | `string[]` de errores en español; vacío si es válida. No comprueba `id` |
| `buildTaskData(input)` | Normaliza un formulario a `TaskData`: recorta textos, `""` → `null`, `status` por defecto `pending` |
| `toggledStatus(status)` | `done → pending`; cualquier otro → `done` |
| `isDone(task)`, `byStart(a, b)` | Predicado y comparador por inicio |

### `domain/pomodoro.js`
`POMODORO_MODE { WORK: "work", BREAK: "break" }`, `POMODORO_DEFAULTS { workSeconds: 1500, breakSeconds: 300 }`, `nextMode(mode)`.

## application/

### `application/task-repository.js` — contrato `TaskRepository`
| Método | Devuelve | Errores |
|---|---|---|
| `list()` | `Promise<Task[]>` sin orden garantizado | Firestore: `permission-denied`, `unavailable`… |
| `create(data)` | `Promise<Task>` con id asignado por el repositorio (un `id` en `data` se ignora) | ídem |
| `update(id, changes)` | `Promise<Task>` completa tras aplicar cambios parciales | id inexistente: memoria `Error("No existe la tarea <id>")`, Firestore `not-found` |
| `remove(id)` | `Promise<void>`; un id inexistente no es error | ídem |

`assertTaskRepository(repo)` lanza `TypeError` si faltan métodos. Los repositorios **no** validan reglas de negocio.

### `application/task.service.js` — `createTaskService(repository)`
| Método | Comportamiento |
|---|---|
| `load()` | Recarga del repositorio activo. `Promise<boolean>`: `false` si quedó obsoleta |
| `useRepository(repo)` | Cambia de repositorio y recarga (mismo retorno que `load`) |
| `getAll()` | Copia de las tareas |
| `add(input)` | Normaliza, valida y crea. Rechaza con los errores del dominio unidos por espacio |
| `update(id, changes)` | Valida el resultado combinado y guarda. Rechaza si el id no existe |
| `toggleDone(id)` | Completar / reabrir (`domain.toggledStatus`) |
| `moveBlock(id, start, end)` | `update(id, { start, end })` |
| `remove(id)` | Elimina |
| `subscribe(cb)` | `cb(copiaDeTareas)` en cada cambio. Devuelve la función para cancelar |

Garantía de aislamiento: ver `ARCHITECTURE.md`, "Aislamiento entre sesiones".

### `application/session.coordinator.js` — `createSessionCoordinator(deps)`
Dependencias: `auth.onAuthChange`, `taskService`, `createUserRepository(uid)`, `createGuestRepository()`, y callbacks `onUserChanged(user)`, `onLoadingChange(bool)`, `onLoadError(error)`.
`start()` → `Promise<unsubscribe>`; rechaza si la autenticación no está disponible (Firebase sin configurar).

### `application/pomodoro.service.js` — `createPomodoroService({ workSeconds?, breakSeconds?, clock? })`
`start()` (idempotente), `pause()`, `reset()`, `onTick(cb)` → cancelar. `cb({ mode, remaining, running })` se llama al suscribirse y en cada cambio. Al terminar un periodo se detiene y cambia de modo; el usuario debe pulsar Iniciar de nuevo.

## infrastructure/

| Módulo | Exporta | Notas |
|---|---|---|
| `firebase/firebase.client.js` | `getFirebase()` → `{ auth, db, authApi, fsApi }` | Carga diferida desde CDN; caché; lanza si falta `config/firebase.config.js` |
| `firebase/firebase-auth.js` | `createFirebaseAuth({ getFirebase? })` | `register`, `login`, `logout`, `resetPassword`, `onAuthChange`. Usuario `{ uid, email }`. Errores con `code` de Firebase |
| `firebase/task.firestore.repository.js` | `createFirestoreTaskRepository(uid, { getFirebase? })` | `TaskRepository` sobre `users/{uid}/tasks` |
| `firebase/task.firestore.mapper.js` | `taskFromDocument(id, data)`, `taskToDocument(task)` | Esquema 1:1; el id no se guarda como campo |
| `memory/task.memory.repository.js` | `createMemoryTaskRepository(initial?)` | `TaskRepository` en memoria; devuelve copias |
| `memory/demo-tasks.js` | `buildSeedTasks(now?)` | 3 tareas en la semana de `now` (desde el lunes) |

## presentation/

| Módulo | Exporta | Ids de `index.html` que usa |
|---|---|---|
| `tasks/task-input.js` | `readTaskInput(fieldIds)` | los que reciba |
| `tasks/task-form.ui.js` | `initTaskForm(taskService)` | `task-form`, `task-title`, `task-description`, `task-start`, `task-end`, `task-due` |
| `tasks/calendar-task-dialog.ui.js` | `initCalendarTaskDialog(taskService)` → `{ open({ start: Date, end: Date }) }` | `event-dialog`, `event-form`, `event-title`, `event-description`, `event-start`, `event-end`, `event-dialog-close`, `event-dialog-cancel` |
| `tasks/task-list.view.js` | `initTaskList(taskService)` | `task-list` |
| `calendar/calendar.view.js` | `createCalendarView()` → `{ mount(el, { onDateSelected, onEventChanged }), render(tasks) }` | (recibe el elemento) |
| `calendar/calendar.mapper.js` | `taskToEvent(task)`, `eventToBlock(event, oldEvent)` | — |
| `pomodoro/pomodoro.ui.js` | `initPomodoroUi(pomodoro)` | `pomodoro-time`, `pomodoro-mode`, `pomodoro-start`, `pomodoro-pause`, `pomodoro-reset` |
| `auth/auth.ui.js` | `initAuthUi(auth)` → `{ setUser(user), disable(reason) }` | `auth-form`, `auth-email`, `auth-password`, `auth-login`, `auth-register`, `auth-reset`, `auth-logout`, `auth-note`, `user-label` |

`onEventChanged({ id, start, end })` puede ser `async`; si lanza, el calendario revierte el evento.

## shared/

| Módulo | Exporta |
|---|---|
| `dom.js` | `byId(id)`: lanza un error que nombra el id si no existe |
| `feedback.js` | `setLoading(bool)`, `showMessage(text, "info"\|"error")`, `clearMessage()`, `runAction(action, { successText?, formatError? })` (nunca relanza). Usa `message` y `loading` |
| `date-time.js` | `localInputToIso`, `dateToLocalInputValue`, `dateToIso`, `formatShortDateTime`, `formatMinutesSeconds`, `startOfWeekMonday`, `MS_PER_MINUTE`, `MS_PER_HOUR` |
