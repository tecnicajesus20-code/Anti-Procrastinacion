# Auditoría técnica de MUVENAPP (fase 1)

Revisión de la rama `Desarrollo` (commit `cde3b22`, 31-oct-2026) antes de la refactorización.
Las rutas de "Dónde" son las **originales** (`src/modules/…`); la correspondencia con las nuevas está en `docs/MODULES.md`. Cada hallazgo indica dónde está, la evidencia, el riesgo, la solución y su estado.

**Estados:** ✅ Resuelto en `refactor/arquitectura-modular` · 📝 Documentado sin corregir (revisión de diseño) · ⏸️ Requiere autorización · ℹ️ Informativo.

## Punto de partida

El código original ya estaba bien encaminado: servicios sin DOM, un único adaptador de FullCalendar, Firebase cargado en un solo archivo, contrato de tarea explícito y reglas de Firestore restrictivas. **No había dependencias circulares ni consultas a Firebase fuera de sus módulos.** La refactorización parte de esa base; no la sustituye.

La evidencia "dinámica" (marcada 🔬) procede del arnés de regresión (`tests/regression/`), que ejecuta la app real con FullCalendar 6.1.15 y un Firebase simulado.

## Resumen

| ID | Prioridad | Hallazgo | Estado |
|---|---|---|---|
| AUD-01 | **Alta** | Carreras al cambiar de sesión: datos de un usuario visibles en otra sesión | ✅ |
| AUD-02 | **Alta** | La plantilla `firebase.config.example.js` no funciona; config local fuera de `.gitignore` | ✅ |
| AUD-03 | Media | Hosting publicaba `firestore.rules` y la documentación interna | ✅ |
| AUD-04 | Media | `task.ui.js` con tres responsabilidades | ✅ |
| AUD-05 | Media | Regla de negocio "completar/reabrir" en la interfaz | ✅ |
| AUD-06 | Media | Conversiones de fecha repetidas en 4 archivos | ✅ |
| AUD-07 | Media | Coordinación de sesión mezclada con la composición en `main.js` | ✅ |
| AUD-08 | Media | Contrato de repositorio solo en comentarios; sin pruebas en el repositorio | ✅ |
| AUD-09 | Baja | Manejo de errores de la UI repetido de tres formas | ✅ |
| AUD-10 | Baja | Código de depuración y opciones inexistentes de FullCalendar | ✅ |
| AUD-11 | Baja | Módulos de Firebase no inyectables (no se podían probar) | ✅ |
| AUD-12 | Media | Errores de diseño visual (botón vacío, semana en martes, clases sin estilo…) | 📝 ver `README_PROVISIONAL_DISENO.md` |
| AUD-13 | Media | Si falla la carga de tareas tras iniciar sesión, se ven las tareas anteriores | ⏸️ |
| AUD-14 | Media | Se puede iniciar sesión con otra cuenta sin cerrar la actual | ⏸️ |
| AUD-15 | Media | Las reglas no validan tipo de `description`/`dueDate` ni formato ISO | ⏸️ |
| AUD-16 | Baja | Si FullCalendar no carga, Pomodoro y cuenta tampoco se inicializan | ⏸️ |
| AUD-17 | Baja | `update` en Firestore hace una lectura extra por cada cambio | ⏸️ |
| AUD-18 | — | "Tareas sin horario" y "edición" no existen en esta versión | ℹ️ |
| AUD-19 | — | Validación duplicada cliente/reglas | ℹ️ |
| AUD-20 | — | `crypto.randomUUID` exige contexto seguro | ℹ️ |

---

## Detalle

### AUD-01 · Carreras al cambiar de sesión — Alta — ✅
- **Dónde:** `src/main.js` (`connectAuth`, callback `async` de `onAuthChange`) y `src/modules/tasks/task.service.js` (`useRepository`, `add`, `update`, `remove`).
- **Evidencia 🔬:**
  - Escenario `race`: Ana inicia sesión (su carga tarda 150 ms) y cierra sesión antes de que termine. Resultado original: etiqueta "Modo demo (sin sesión)" y en la lista **"Privada de Ana"**.
  - Escenario `raceWrite`: Ana crea una tarea y cierra sesión mientras se guarda. Resultado original: la tarea **"En vuelo" aparece entre las tareas demo**.
- **Problema:** Firebase no espera al callback `async`; dos cambios de sesión se ejecutan en paralelo y gana el que termina último, no el más reciente. Las escrituras en vuelo se aplican al estado de la sesión siguiente. Además, una carga obsoleta podía ocultar el indicador "Cargando…" de la vigente.
- **Riesgo:** exposición de datos de un usuario a quien use el mismo dispositivo después; operaciones dirigidas al repositorio equivocado.
- **Solución aplicada:** `task.service` descarta el resultado de cargas obsoletas (ticket) y de escrituras cuyo repositorio ya no es el activo (identidad). `session.coordinator` solo deja que el último cambio controle carga y errores. La escritura sí se completa en su repositorio de origen (no se pierden datos).
- **Verificación:** escenarios `race` y `raceWrite` con diferencia esperada; 4 pruebas unitarias específicas.

### AUD-02 · Configuración de Firebase — Alta — ✅
- **Dónde:** `src/config/firebase.config.example.js`, `.gitignore`, `README` de `public/`.
- **Evidencia 🔬:** copiando la plantilla original como `firebase.config.js` (paso 4 del README), la app responde "Firebase no está configurado". La plantilla no exportaba `firebaseConfig` e importaba `firebase/app` (especificador npm que el navegador no resuelve). Con la plantilla corregida, el SDK se inicializa. `firebase.config.js` nunca estuvo en Git, pero tampoco en `.gitignore`, aunque el README lo afirmaba.
- **Riesgo:** un integrante nuevo no puede activar Firebase; alguien puede subir su config local por error.
- **Solución aplicada:** plantilla con `export const firebaseConfig` y sin imports; `.gitignore` incluye `public/src/config/firebase.config.js`.
- **Nota para el despliegue:** el sitio desplegado funciona porque quien despliega tiene su `firebase.config.js` local. **Ese archivo sigue en `src/config/`**; solo cambió el archivo que lo carga (con la ruta relativa ajustada y verificada).

### AUD-03 · Archivos internos publicados — Media — ✅
- **Dónde:** `firebase.json` (`"public": "public"`) y `public/firestore.rules`, `public/README.md`, `public/PROPUESTA_INTEGRACION_FIREBASE.md`.
- **Problema:** Hosting publica toda la carpeta `public/`: las reglas y la documentación eran descargables desde el sitio.
- **Riesgo:** bajo para la seguridad real (las reglas no son secretas), pero da información innecesaria a terceros.
- **Solución aplicada:** reglas a la raíz (contenido idéntico, similitud 100 %) y `firebase.json` → `"rules": "firestore.rules"`. La documentación sale de `public/`. Prueba automática: `firebase.json` apunta a archivos existentes y `public/` no contiene `.rules`, `.md` ni config local.

### AUD-04 · `task.ui.js` con tres responsabilidades — Media — ✅
- **Dónde:** `src/modules/tasks/task.ui.js` (122 líneas): formulario de la lista, diálogo del calendario y renderizado de la lista.
- **Solución aplicada:** `presentation/tasks/task-form.ui.js`, `calendar-task-dialog.ui.js` y `task-list.view.js`; la lectura de campos se comparte en `task-input.js`, así ambos formularios entregan el mismo formato al mismo caso de uso.

### AUD-05 · Regla de negocio en la interfaz — Media — ✅
- **Dónde:** `task.ui.js:105` — `status: isDone ? TASK_STATUS.PENDING : TASK_STATUS.DONE`.
- **Solución aplicada:** `domain/task.js#toggledStatus` + caso de uso `taskService.toggleDone(id)`. Comportamiento idéntico (incluido `in_progress → done`, cubierto por prueba).

### AUD-06 · Conversiones de fecha duplicadas — Media — ✅
- **Dónde:** `task.ui.js` (`toIso`, `toLocalInputValue`, `toLocaleString`), `calendar.mapper.js` (`toISOString`, `60 * 60 * 1000`), `task.seed.js` (cálculo del lunes, `toISOString`), `pomodoro.ui.js` (`pad`).
- **Solución aplicada:** `shared/date-time.js`. Pruebas en cuatro zonas horarias (UTC−5, UTC+1, UTC+5:30, UTC+13), incluidos cambios de horario.

### AUD-07 · Coordinación de sesión en `main.js` — Media — ✅
- **Dónde:** `main.js:23-39`. Mezclaba composición, decisión de repositorio, carga e indicadores.
- **Solución aplicada:** `application/session.coordinator.js`, sin DOM (callbacks), probado de forma aislada. `main.js` queda como raíz de composición.

### AUD-08 · Contrato implícito y sin pruebas — Media — ✅
- **Dónde:** `memory.repository.js:3` ("Implementa la misma interfaz…"); el README decía "Verificado con Node" pero no había pruebas en el repositorio.
- **Solución aplicada:** `application/task-repository.js` (typedef + `assertTaskRepository`), la misma batería de contrato para memoria y Firestore, y pruebas de regresión automáticas. Ver `docs/TESTING.md`.

### AUD-09 · Manejo de errores repetido — Baja — ✅
- **Dónde:** `run()` en `task.ui.js:21`, otro `run()` distinto en `auth.ui.js:11` y un `try/catch` en línea en `task.ui.js:62`.
- **Solución aplicada:** `shared/feedback.js#runAction` con opciones `successText` y `formatError`.

### AUD-10 · Depuración y opciones inexistentes — Baja — ✅
- **Dónde:** `calendar.view.js:18` `console.log(window.innerWidth)`; líneas 34-36 `revertEdits`, `revertDuration`, `revertEasing`.
- **Evidencia 🔬:** consola original: `"1024"`, `Unknown option 'revertEdits'`, `'revertDuration'`, `'revertEasing'`. Esas opciones no existen en FullCalendar 6; la animación de reversión es `dragRevertDuration` (500 ms por defecto), que ya estaba activa.
- **Solución aplicada:** eliminadas. DOM idéntico; consola limpia. Una prueba impide reintroducir `console.log`.

### AUD-11 · Módulos de Firebase no inyectables — Baja — ✅
- **Dónde:** `auth.service.js` (objeto singleton), `firestore.repository.js` (import fijo de `getFirebase`).
- **Solución aplicada:** `createFirebaseAuth({ getFirebase })` y `createFirestoreTaskRepository(uid, { getFirebase })`, con valores por defecto reales.

### AUD-12 · Errores de diseño visual — Media — 📝
Ver `README_PROVISIONAL_DISENO.md` (D-01 a D-10). Por instrucción expresa **no se han corregido**; están comentados en las líneas afectadas con la solución sugerida.

### AUD-13 · Error de carga tras iniciar sesión — Media — ⏸️
- **Dónde:** `task.service.js#loadFrom` (antes `load`) y `session.coordinator.js`.
- **Evidencia 🔬:** escenario `firebaseFlow`, paso "error al cargar tareas": etiqueta `ana@x.com`, mensaje de error y en la lista **las tareas demo**. El repositorio activo ya es el de Firestore, así que "Completar" o "Eliminar" sobre esas tareas apunta a ids que no existen en la cuenta de Ana.
- **Propuesta:** al fallar la carga, vaciar la lista (o mostrar estado "sin datos" con botón de reintento). **Cambia lo que el usuario ve**, por eso no se aplicó.
- **Relacionado:** durante la carga normal de una sesión se siguen viendo las tareas de la anterior hasta que llegan las nuevas (en el flujo habitual login→Firestore se ven unos instantes las tareas demo). Propuesta: vaciar al cambiar de sesión.

### AUD-14 · Cambio de cuenta sin cerrar sesión — Media — ⏸️
- **Dónde:** `auth.ui.js#setUser` solo oculta/muestra "Cerrar sesión"; "Iniciar sesión" y "Crear cuenta" siguen activos con sesión abierta.
- **Riesgo:** reducido tras AUD-01, pero es un flujo poco claro.
- **Propuesta:** ocultar "Iniciar sesión"/"Crear cuenta" con sesión iniciada. Cambia la interfaz: requiere visto bueno de diseño.

### AUD-15 · Reglas de Firestore parciales — Media — ⏸️
- **Dónde:** `firestore.rules:18-25`.
- **Problema:** `description` y `dueDate` no se validan (podrían ser números, mapas o textos enormes); `start`/`end` solo se comprueban como `string`, y `end > start` compara texto, lo cual es correcto solo si ambos están en el mismo formato ISO.
- **Propuesta (no aplicada: cambia las reglas):**
  ```
  && (!('description' in t) || t.description == null || (t.description is string && t.description.size() <= 2000))
  && (!('dueDate' in t) || t.dueDate == null || t.dueDate is string)
  && t.start.matches('^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$')
  && t.end.matches('^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$')
  ```
  Antes de desplegar: comprobar en Firebase Console que ningún documento existente quedaría rechazado en su próxima actualización.

### AUD-16 · Fallo de FullCalendar bloquea toda la app — Baja — ⏸️
- **Dónde:** `main.js#startApp`. Si el CDN de FullCalendar falla, `calendar.mount` lanza antes de iniciar Pomodoro y la cuenta. Se ha conservado el orden original.
- **Propuesta:** iniciar Pomodoro y cuenta antes del calendario o capturar su error por separado.

### AUD-17 · Lectura extra en `update` de Firestore — Baja — ⏸️
- **Dónde:** `task.firestore.repository.js#update`: `updateDoc` + `getDoc` por cada cambio (una lectura facturable más por cada movimiento en el calendario).
- **Propuesta:** devolver `{ ...actual, ...changes }` sin releer. Cambia la fuente del dato devuelto; se dejó como estaba.

### AUD-18 · Funcionalidades mencionadas que no existen — ℹ️
La misión pide conservar **tareas sin horario** y **edición de tareas**. En esta versión:
- Toda tarea exige `start` y `end` (`domain/task.js#validateTask`, `firestore.rules` `hasAll([... 'start', 'end'])`). **No hay tareas sin horario.**
- "Edición" se limita a completar/reabrir y mover/redimensionar en el calendario. No hay formulario para cambiar título, descripción o fecha límite.

No se han añadido, porque la misión prohíbe incorporar funcionalidades. Si existen en otra rama, esa rama no es la entregada.

### AUD-19 · Validación duplicada cliente/reglas — ℹ️
`validateTask` y `isValidTask` validan lo mismo. Es intencionado (defensa en profundidad: las reglas son la seguridad real), pero hay que mantenerlas sincronizadas. El Firebase falso del arnés contiene una copia de las reglas en JS que también debe actualizarse.

### AUD-20 · `crypto.randomUUID` — ℹ️
El repositorio en memoria usa `crypto.randomUUID()`, que solo existe en contextos seguros (`https://` o `localhost`). Abrir la app por IP local con `http://` (p. ej. desde el móvil en la misma red) hace fallar la creación en modo demo.

## Comprobaciones sin hallazgos
- **Dependencias circulares:** ninguna, antes ni después (verificado automáticamente).
- **Firebase fuera de su módulo:** ninguno.
- **Inyección de HTML:** la lista usa `textContent`; sin `innerHTML` en todo el código.
- **Código sin referencias:** `taskService.getAll()` y las funciones de cancelación de `subscribe`/`onTick`/`onAuthChange` no se usan hoy, pero forman parte de la API pública documentada. Se conservan.
- **Imports dinámicos:** solo `firebase.config.js` y los módulos del SDK en `firebase.client.js`; revisados y probados.
