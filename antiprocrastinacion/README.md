# Sistema Antiprocrastinación — base inicial (MVP)

Aplicación web para planificar tareas, asignarlas a bloques de tiempo y trabajar con un temporizador Pomodoro.
Proyecto académico (entrega: 4 de noviembre de 2026). **No usa npm ni build**: son archivos estáticos.

## Ejecutar el proyecto

Necesitas internet (las librerías se cargan desde CDN) y un servidor estático local.
Los módulos ES **no funcionan abriendo `index.html` con doble clic**.

1. Clona el repositorio y entra a la carpeta.
2. Inicia un servidor, cualquiera de estas opciones:
   - VS Code: extensión **Live Server** → "Go Live".
   - Python: `python -m http.server 8080` y abre http://localhost:8080
   - Node: `npx serve`
3. Verás el calendario con 3 tareas de prueba. Arrastra sobre un espacio libre para crear una tarea o arrastra una existente para moverla.

Sin configurar Firebase la app funciona en **modo demo** (datos en memoria, se pierden al recargar) y el formulario de cuenta queda desactivado con un aviso. No se simula ninguna sesión.

## Versiones de dependencias (fijadas en la URL)

| Librería | Versión | Dónde se declara |
|---|---|---|
| FullCalendar (paquete completo) | 6.1.15 | `<script>` en `index.html` |
| Firebase JS SDK (app, auth, firestore) | 10.14.1 | constante `FIREBASE_VERSION` en `src/config/firebase.js` |

No mezclar versiones de FullCalendar. Si se actualiza una versión, probar el calendario y actualizar esta tabla.

## Configurar Firebase (cuando el equipo esté listo)

1. En Firebase Console crea un proyecto y una app web.
2. Authentication → activa el proveedor **Correo/contraseña**.
3. Firestore Database → crea la base de datos.
4. Copia `src/config/firebase.config.example.js` como `src/config/firebase.config.js` y pega tus datos. Ese archivo está en `.gitignore`: **no se sube**.
5. Pega el contenido de `firestore.rules` en Firestore → Reglas → Publicar.
6. Recarga la app: crea una cuenta, inicia sesión y las tareas se guardarán en `users/{uid}/tasks`.

> La configuración web de Firebase no es un secreto; la seguridad real la dan las **reglas de Firestore**, nunca los filtros de la interfaz.

## Estructura

```
index.html                 Solo etiquetas, clases (CSS) e ids (JS)
firestore.rules            Aislamiento por usuario + validación de tareas
src/main.js                Crea y conecta los módulos (único lugar donde se conectan)
src/config/                Acceso a Firebase y plantilla de configuración
src/ui/                    dom.js (byId) y feedback.js (carga y mensajes)
src/styles/                base.css (variables) · layout.css (estructura) · components.css
src/modules/tasks/         task.model (contrato), task.service (lógica), task.ui, task.seed (datos demo)
src/modules/calendar/      calendar.view (único que usa FullCalendar), calendar.mapper (Task ⇄ evento)
src/modules/pomodoro/      pomodoro.service (lógica), pomodoro.ui
src/modules/auth/          auth.service (Firebase Auth), auth.ui
src/modules/storage/       memory.repository (demo), firestore.repository (real)
```

## Reglas del equipo

- HTML solo con etiquetas; estilos con **clases**; JS se engancha con **ids** (`byId`). En `.js` solo JavaScript (y HTML/CSS que haya que inyectar).
- Los **servicios** (`*.service.js`, repositorios) no tocan el DOM. La UI (`*.ui.js`) no contiene lógica de negocio.
- El calendario **no guarda datos**: dibuja las tareas de `taskService`, avisa cuando mueves un evento y permite seleccionar un espacio libre para abrir el formulario de creación.
- Todo cambio de tareas pasa por `taskService`. Fechas siempre en ISO 8601.
- Comentar en español qué hace cada archivo y cada función pública.

## Contrato de datos de una tarea

`id`, `title` (obligatorio), `description` (opcional), `status` (`pending` | `in_progress` | `done`), `dueDate` (opcional), `start` y `end` (obligatorios: cada tarea tiene un solo bloque horario). Ver `src/modules/tasks/task.model.js`.

## Funciones públicas por módulo

- `taskService`: `load`, `useRepository`, `getAll`, `add`, `update`, `remove`, `moveBlock`, `subscribe`
- `calendarView`: `mount(element, { onEventMoved })`, `render(tasks)`
- `pomodoroService`: `start`, `pause`, `reset`, `onTick`
- `authService`: `register`, `login`, `logout`, `resetPassword`, `onAuthChange`
- Repositorio (memoria o Firestore): `list`, `create`, `update`, `remove`

## Cómo agregar una funcionalidad

1. Lógica nueva → `*.service.js` del módulo que corresponda (o un módulo nuevo en `src/modules/`).
2. Guardar datos nuevos → ampliar el contrato en `task.model.js`, ambos repositorios y `firestore.rules`.
3. Pantalla nueva → etiquetas con clases en `index.html`, estilos en `components.css`, comportamiento en un `*.ui.js`.
4. Conectar en `src/main.js`.

## Estado de verificación

- Verificado con Node: sintaxis de todos los `.js`, validación y servicio de tareas, repositorio en memoria, mapeo calendario ⇄ tarea, temporizador Pomodoro y que cada id usado en JS exista en `index.html`.
- **No verificado** (requiere navegador y proyecto Firebase): vista del calendario, arrastrar y soltar, diseño responsive, autenticación real, Firestore y las reglas de seguridad. Probarlo es el primer paso de cada integrante.
- Fuera del alcance de la base: n8n, IA, puntos, recompensas, backend Java.
