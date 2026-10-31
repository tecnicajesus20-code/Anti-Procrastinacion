# Revisión de diseño — PROVISIONAL

> Documento temporal para el equipo de diseño (Valeria). **Ninguno de estos puntos se ha corregido.**
> Cada uno está marcado en el código con `⚠️ REVISIÓN PENDIENTE (D-xx)` junto a la solución sugerida.
> Al resolver un punto, borrad el comentario del código y la fila de esta tabla. Cuando la tabla quede vacía, borrad este archivo.

Las evidencias marcadas con 🔬 se obtuvieron ejecutando la app con FullCalendar 6.1.15 real (ver `docs/TESTING.md`).

| ID | Prioridad | Qué ve el usuario | Dónde |
|---|---|---|---|
| D-01 | **Alta** | Un botón vacío en la barra del calendario que no hace nada; en móvil no se puede volver a la vista de un día | `presentation/calendar/calendar.view.js` (`headerToolbar`) |
| D-02 | **Alta** | La semana empieza en martes; una de las tres tareas demo no aparece al abrir la app | `presentation/calendar/calendar.view.js` (`firstDay`) |
| D-03 | **Alta** | Los mensajes de error no tienen color: se ven menos que los informativos | `src/styles/components.css` (`.message--info`) |
| D-04 | Media | En el calendario, una tarea completada se ve igual que una pendiente | `src/styles/components.css` (eventos) |
| D-10 | Media | "Eliminar" tiene el mismo aspecto que "Completar" | `src/styles/components.css` (junto a D-03) |
| D-05 | Media | Ninguno, pero el diseño se rompe si se renombra un id o en navegadores sin `:has()` | `src/styles/layout.css`, `components.css` |
| D-06 | Media | Errores de cuenta en jerga técnica: `auth/invalid-credential` | `presentation/auth/auth.ui.js` |
| D-08 | Baja | Los lectores de pantalla anuncian los errores con poca prioridad | `index.html` (`#message`) |
| D-09 | Baja | Al crear cuenta, el navegador no sugiere una contraseña nueva | `index.html` (`#auth-password`) |
| D-07 | Baja | Ninguno: CSS sin uso | `src/styles/components.css` |

---

### D-01 · Botón de vista inexistente
- **Evidencia 🔬:** `headerToolbar.right: "timeGridWeek,timeGridDays"`. `timeGridDays` no es una vista de FullCalendar: el botón `.fc-timeGridDays-button` se dibuja **sin texto** y al pulsarlo la vista no cambia. En móvil la vista inicial es `timeGridDay`, pero no hay botón para volver a ella desde "semana".
- **Sugerencia:** `right: "timeGridWeek,timeGridDay"`.

### D-02 · La semana empieza en martes
- **Evidencia 🔬:** `firstDay: 2` (0 = domingo, 1 = lunes, 2 = martes). Hoy, 31-oct-2026, la vista semanal muestra **martes 27 → lunes 2**. La tarea demo "Estudiar para el parcial" está el lunes 26 (las tareas demo se generan desde el lunes): **no se ve al abrir la app**.
- **Sugerencia:** `firstDay: 1`. Si el martes es intencionado, ajustar `infrastructure/memory/demo-tasks.js` para que las tareas caigan dentro de la semana visible.

### D-03 · Mensajes de error sin estilo
- **Evidencia:** `shared/feedback.js` aplica `message--error`; hay **0 reglas** para esa clase (sí existe `.message--info`). El error aparece sin fondo ni borde de color.
- **Sugerencia** (sigue el patrón de `.message--info`):
  ```css
  .message--error { background: rgba(254, 226, 226, 0.85); color: #991B1B; border-left: 4px solid #DC2626; }
  ```

### D-04 · Estado de la tarea invisible en el calendario
- **Evidencia:** cada evento recibe `event--pending`, `event--in_progress` o `event--done` (`calendar.mapper.js`); hay **0 reglas** para ellas. En la lista la tarea completada aparece tachada; en el calendario, idéntica a las demás.
- **Sugerencia:** `.calendar .event--done { opacity: 0.6; text-decoration: line-through; }`

### D-10 · Botón "Eliminar" sin estilo de peligro
- **Evidencia:** la lista crea el botón con `btn btn--danger`; hay **0 reglas** para `.btn--danger`.
- **Sugerencia:** `.btn--danger { color: #B91C1C; border-color: #F3C4C4; }` y `.btn--danger:hover { background: #FEF2F2; border-color: #DC2626; }`

### D-05 · Estilos enganchados a ids de JavaScript
- **Evidencia:** `.card:has(#pomodoro-time)`, `.card:has(#task-form)`, `.card:has(#auth-form)` (áreas de la cuadrícula), `#task-form .btn--primary`, `.card:has(#pomodoro-time) #pomodoro-reset`. El propio README del equipo establece "estilos con clases, JS con ids".
- **Riesgo:** renombrar un id rompe el diseño sin error visible. `:has()` no existe en Firefox < 121 ni Safari < 15.4: allí las tarjetas pierden su área y la cuadrícula se descoloca.
- **Sugerencia:** añadir `card--pomodoro`, `card--tasks` y `card--auth` a las `<section>` y una clase como `btn--block` al botón del formulario; sustituir los selectores. Es el único punto que requiere tocar HTML.

### D-06 · Errores de autenticación en jerga técnica
- **Evidencia 🔬:** con credenciales incorrectas se muestra literalmente `auth/invalid-credential`; con contraseña corta, `auth/weak-password`.
- **Sugerencia:** una tabla de traducción en `presentation/auth/auth.ui.js` (función `authErrorText`), p. ej. `"auth/invalid-credential": "Correo o contraseña incorrectos."`, con el código como respaldo para casos no traducidos.

### D-08 · Accesibilidad de los errores
- **Evidencia:** `#message` tiene `role="status"` (anuncio "educado") y se usa también para errores.
- **Sugerencia:** `role="alert"` para errores (cambiándolo desde `showMessage`) o un elemento separado.

### D-09 · Autocompletado de contraseña al registrarse
- **Evidencia:** `autocomplete="current-password"` también al pulsar "Crear cuenta".
- **Sugerencia (opcional):** cambiar a `new-password` al registrarse.

### D-07 · CSS sin uso
- `.move-log` no se usa en HTML ni en JS. Las reglas `.fc-daygrid-*` no se aplican (solo hay vistas `timeGrid`). Inofensivo; eliminar o conservar es decisión de diseño.

## Observaciones (no son errores)
- El calendario muestra las 24 h con `height: "auto"`, por lo que la tarjeta es muy alta, sobre todo en móvil.
- El diálogo del calendario no tiene "Fecha límite"; el formulario de la lista sí.
- El título de la pestaña es "Sistema Antiprocrastinación" y la cabecera "Antiprocrastinación"; la marca MUVENAPP no aparece en la interfaz.
