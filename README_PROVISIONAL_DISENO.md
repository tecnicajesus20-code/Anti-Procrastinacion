# Revisión de diseño — PROVISIONAL

> Documento temporal para el equipo de diseño (Valeria). **Los puntos que siguen en la tabla no se han corregido.**
> Cada uno está marcado en el código con `⚠️ REVISIÓN PENDIENTE (D-xx)` junto a la solución sugerida.
> Al resolver un punto, borrad el comentario del código y la fila de esta tabla. Cuando la tabla quede vacía, borrad este archivo.

> **Resueltos con la integración del diseño nuevo (solo CSS/HTML, sin tocar lógica):** D-03 (mensajes de error con color), D-04 (tarea completada tachada en el calendario), D-05 (estilos por clases, sin `:has()` ni ids de JS), D-07 (CSS sin uso eliminado) y D-10 (botón "Eliminar" con estilo de peligro). También se resolvió D-06 traduciendo los errores frecuentes de autenticación. Sus filas y secciones se borraron de este documento.
>
> **Siguen pendientes** porque cambian comportamiento y no se quisieron tocar en un cambio solo visual. La propuesta de diseño ya trae la solución de D-01 (`timeGridWeek,timeGridDay`) y D-02 (`firstDay: 1`).

Las evidencias marcadas con 🔬 se obtuvieron ejecutando la app con FullCalendar 6.1.15 real (ver `docs/TESTING.md`).

| ID | Prioridad | Qué ve el usuario | Dónde |
|---|---|---|---|
| D-01 | **Alta** | Un botón vacío en la barra del calendario que no hace nada; en móvil no se puede volver a la vista de un día | `presentation/calendar/calendar.view.js` (`headerToolbar`) |
| D-02 | **Alta** | La semana empieza en martes; una de las tres tareas demo no aparece al abrir la app | `presentation/calendar/calendar.view.js` (`firstDay`) |
| D-08 | Baja | Los lectores de pantalla anuncian los errores con poca prioridad | `index.html` (`#message`) |
| D-09 | Baja | Al crear cuenta, el navegador no sugiere una contraseña nueva | `index.html` (`#auth-password`) |

---

### D-01 · Botón de vista inexistente
- **Evidencia 🔬:** `headerToolbar.right: "timeGridWeek,timeGridDays"`. `timeGridDays` no es una vista de FullCalendar: el botón `.fc-timeGridDays-button` se dibuja **sin texto** y al pulsarlo la vista no cambia. En móvil la vista inicial es `timeGridDay`, pero no hay botón para volver a ella desde "semana".
- **Sugerencia:** `right: "timeGridWeek,timeGridDay"`.

### D-02 · La semana empieza en martes
- **Evidencia 🔬:** `firstDay: 2` (0 = domingo, 1 = lunes, 2 = martes). Hoy, 31-oct-2026, la vista semanal muestra **martes 27 → lunes 2**. La tarea demo "Estudiar para el parcial" está el lunes 26 (las tareas demo se generan desde el lunes): **no se ve al abrir la app**.
- **Sugerencia:** `firstDay: 1`. Si el martes es intencionado, ajustar `infrastructure/memory/demo-tasks.js` para que las tareas caigan dentro de la semana visible.

### D-06 · Errores de autenticación en jerga técnica
- **Evidencia 🔬:** con credenciales incorrectas se muestra literalmente `auth/invalid-credential`; con contraseña corta, `auth/weak-password`.
- **Sugerencia:** una tabla de traducción en `presentation/auth/auth.ui.js` (función `authErrorText`), p. ej. `"auth/invalid-credential": "Correo o contraseña incorrectos."`, con el código como respaldo para casos no traducidos.

### D-08 · Accesibilidad de los errores
- **Evidencia:** `#message` tiene `role="status"` (anuncio "educado") y se usa también para errores.
- **Sugerencia:** `role="alert"` para errores (cambiándolo desde `showMessage`) o un elemento separado.

### D-09 · Autocompletado de contraseña al registrarse
- **Evidencia:** `autocomplete="current-password"` también al pulsar "Crear cuenta".
- **Sugerencia (opcional):** cambiar a `new-password` al registrarse.

## Observaciones (no son errores)
- El calendario muestra las 24 h con `height: "auto"`, por lo que la tarjeta es muy alta, sobre todo en móvil.
- El diálogo del calendario no tiene "Fecha límite"; el formulario de la lista sí.
- El título de la pestaña es "Sistema Antiprocrastinación" y la cabecera "Antiprocrastinación"; la marca MUVENAPP no aparece en la interfaz.
