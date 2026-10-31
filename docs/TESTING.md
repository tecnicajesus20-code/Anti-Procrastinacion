# Pruebas

## Cómo ejecutarlas

```bash
npm install                 # solo la primera vez: jsdom 24.1.3 y fullcalendar 6.1.15 (devDependencies)
npm test                    # unitarias + arquitectura + configuración de despliegue (node:test, sin red)
npm run test:regression     # compara el comportamiento contra la rama Desarrollo
TZ=Europe/Madrid npm test   # repetir en otra zona horaria
```

Requiere Node 22 (verificado con 22.22.2).

## Tres niveles

| Nivel | Archivos | Qué demuestra |
|---|---|---|
| Unitarias | `tests/unit/{domain,date-time,repositories,application}.test.js` | Reglas, conversiones, contrato de repositorios, casos de uso, carreras de sesión, Pomodoro |
| Arquitectura | `tests/unit/{architecture,deploy-config}.test.js` | Capas permitidas, sin ciclos, Firebase/FullCalendar/DOM solo donde corresponde, sin `console.log`, ids existentes en `index.html`, `firebase.json` apunta a archivos reales y `public/` no expone reglas ni docs |
| Regresión | `tests/regression/` | La app completa se comporta igual que `Desarrollo` |

### Cómo funciona la regresión
`compare.mjs` extrae `Desarrollo` en un `git worktree` temporal y ejecuta los mismos escenarios sobre ambos árboles con:
- **jsdom** para `index.html` (sin modificar) y **FullCalendar 6.1.15 real** (la misma versión del CDN);
- un **Firebase falso** (`fakes/`) que redirige las URLs de gstatic. Implementa Auth y Firestore en memoria, aplica una copia en JS de `firestore.rules`, evalúa el token **al enviar** la petición (como el SDK real) y permite inyectar latencia y errores.

Tras cada paso guarda una "foto": etiqueta de usuario, mensaje y su clase, indicador de carga, estado del formulario de cuenta, diálogo y sus campos, la lista completa (clases, títulos, horas, botones), los eventos del calendario con sus clases y la vista, la barra de herramientas, el Pomodoro y todos los documentos de Firestore. Luego compara ambas fotos campo a campo, en `America/Bogota` y `Europe/Madrid`.

Las diferencias intencionadas se declaran en `EXPECTED_DIFFS` con su justificación. Cualquier otra diferencia hace fallar la ejecución.

## Resultados (31-oct-2026, rama `refactor/arquitectura-modular`)

**Unitarias y arquitectura: 40 de 40 aprobadas** en `America/Bogota`, `Europe/Madrid`, `Asia/Kolkata`, `Pacific/Auckland` y `UTC`.

**Regresión: sin regresiones no aprobadas.**

| Escenario | Pasos | Bogotá | Madrid |
|---|---|---|---|
| `demo` | 16 | ✓ idéntico | ✓ idéntico |
| `pomodoro` | 8 | ✓ | ✓ |
| `mobile` (ancho 400 px) | 1 | ✓ | ✓ |
| `demo-fbconfig` (Firebase configurado, sin sesión) | 16 | ✓ | ✓ |
| `firebaseFlow` | 17 | ✓ | ✓ |
| `reload` (dos procesos, misma "nube") | 2 | ✓ | ✓ |
| `race` | 1 | ≈ diferencia esperada (AUD-01) | ≈ |
| `raceWrite` | 1 | ≈ diferencia esperada (AUD-01) | ≈ |

Diferencias esperadas:
- `race`, tras login→logout rápido: **antes** la lista mostraba "Privada de Ana" en modo demo; **ahora** muestra las tareas demo.
- `raceWrite`, tras crear→logout: **antes** "En vuelo" (de Ana) aparecía entre las tareas demo; **ahora** no aparece (y sigue guardada en la cuenta de Ana).
- Consola, en todos los escenarios: **antes** `"1024"` y 3 avisos `Unknown option 'revert…'`; **ahora** vacía (AUD-10).

Las pruebas de arquitectura se validaron con mutaciones: al introducir una importación prohibida y un ciclo, ambas pruebas fallaron como debían.

## Matriz de regresión solicitada

Leyenda: ✅ ejecutada y aprobada · ❌ ejecutada y fallida · ⏳ pendiente · 🔥 requiere Firebase real o navegador · ➖ no aplica

| # | Prueba | Estado | Detalle |
|---|---|---|---|
| 1 | Inicio de sesión | ✅ simulado · 🔥 real | `firebaseFlow`: credenciales correctas, incorrectas e inexistentes |
| 2 | Registro | ✅ simulado · 🔥 real | Registro correcto, contraseña débil y correo duplicado (vía login) |
| 3 | Cierre de sesión | ✅ simulado · 🔥 real | Vuelve al modo demo y oculta "Cerrar sesión" |
| 4 | Carga de tareas | ✅ | Demo y Firestore; error de carga (`unavailable`) |
| 5 | Creación desde la lista | ✅ | Normalización de espacios, fecha límite, fin < inicio, título vacío |
| 6 | Creación desde el calendario | ✅ · 🔥 gesto | Se invoca el callback `select` de FullCalendar; el gesto de arrastrar con el ratón no se simula |
| 7 | Tareas sin horario | ➖ | **No existen en esta versión** (AUD-18) |
| 8 | Edición | ✅ (lo existente) | Completar, reabrir y `in_progress → done`. No hay edición de título o descripción (AUD-18) |
| 9 | Eliminación | ✅ | Demo y Firestore |
| 10 | Movimiento de bloques | ✅ · 🔥 gesto | `eventDrop`, `eventResize`, soltar sin `end` (conserva la duración) y reversión ante un error de Firestore |
| 11 | Persistencia tras recargar | ✅ simulado · 🔥 real | `reload`: dos procesos separados y sesión persistida |
| 12 | Aislamiento entre usuarios | ✅ simulado · 🔥 reglas reales | Beto no ve las tareas de Ana; carreras de sesión (AUD-01) |
| 13 | Errores de Firestore | ✅ | `unavailable` en `list`, `create` y `update`; `permission-denied` |
| 14 | Pomodoro | ✅ · 🔥 tiempo real | Reloj inyectado: doble inicio, pausa, fin de trabajo → descanso → trabajo, reinicio |
| 15 | Diseño móvil y escritorio | ✅ parcial · 🔥 visual | HTML y CSS idénticos al original sin comentarios; vista inicial `timeGridDay` en móvil y `timeGridWeek` en escritorio. El renderizado visual no se puede comprobar en jsdom |

**Ninguna prueba ejecutada falló.**

## Límites honestos
- **jsdom no maqueta:** no verifica colores, tamaños, responsive ni animaciones. La garantía visual procede de que HTML y CSS no cambiaron, salvo comentarios.
- **Los gestos de FullCalendar no se simulan:** se invocan sus callbacks (`select`, `eventDrop`, `eventResize`) con los mismos argumentos que pasa la librería.
- **El Firebase falso es una aproximación.** Sus reglas son una copia manual de `firestore.rules`: si cambian las reglas, hay que actualizar `tests/regression/fakes/firebase-firestore.js`.
- La foto de fechas depende del día de ejecución (las tareas demo se generan en la semana actual). Por eso se comparan dos árboles en la misma ejecución, en lugar de guardar fotos.

## Prueba manual recomendada antes de fusionar (🔥)
1. Configurar `firebase.config.js` y servir `public/` en `localhost`.
2. Crear dos cuentas. Con la primera, crear tareas desde la lista y desde el calendario, moverlas, redimensionarlas, completarlas y eliminarlas. Recargar y comprobar que persisten.
3. Cerrar sesión, entrar con la segunda cuenta y comprobar que no se ve nada de la primera.
4. En Firebase Console, comprobar que los documentos siguen en `users/{uid}/tasks` con los mismos campos.
5. `firebase emulators:start --only firestore` o, en un proyecto de pruebas, `firebase deploy --only firestore:rules` para validar que las reglas se encuentran en su nueva ruta.
6. Repetir 2–3 en un móvil (ancho < 600 px) y en escritorio.
