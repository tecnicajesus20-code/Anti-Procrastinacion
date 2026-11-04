# Categorías, dificultad por bloque, puntos y ciclo del bloque

Rama: `feacture/Categorias&dificultad` (sale de `Desarrollo` en `bae95ea`). Cambios **aditivos**: las tareas guardadas antes siguen siendo válidas y se comportan igual.

## Decisiones aprobadas
| Tema | Decisión |
|---|---|
| Categorías base | Hogar, Trabajo, Estudio, Entretenimiento, Ocio. No se guardan ni se eliminan |
| Categorías propias | `users/{uid}/categories/{id}` (demo: `localStorage`). Al eliminar una, sus tareas pasan a **Ocio** antes de borrarla |
| Ocio | Categoría normal. **No** se aplica al tiempo libre |
| Dificultad | Por **bloque**. Fácil ≤30, Moderada ≤45, Intermedia ≤60, Desafío ≤120, Hardcore sin límite (inclusive) |
| Puntos | `máx(1, round(mult × min/15))`; no completar = `−round(1,5 × puntos)`. Por bloque y una sola vez |
| Completar | Botón por bloque. La tarea pasa a `done` cuando **todos** sus bloques están completados. En tareas con dificultad se oculta el «Completar» de la tarea; las antiguas lo conservan |
| Inicio de bloque | Antes de iniciar (Enfocar, Iniciar Pomodoro, alarma) se pide «Define una tarea concreta…» una vez por bloque. Cancelar no inicia nada |
| Fin de bloque | «¿Terminaste la tarea?» abierto hasta 3 min tras el fin → si no hay respuesta, queda en la campanita **sin puntos** → 24 h sin respuesta = no realizado (`source: "timeout"`) |
| Tiempo libre | Huecos entre el primer y el último bloque de cada día. Días sin bloques no suman. No se crean bloques de Ocio |
| Estadísticas | Solo lógica y pruebas (`domain/stats.js`); la pantalla se integrará en Perfil |
| Obligatorios | Categoría y dificultad al **crear**; opcionales al editar tareas/bloques antiguos |
| Calendario | Mover/redimensionar un bloque **con** dificultad por encima de su límite se rechaza y el evento vuelve a su sitio |

## Modelo de datos (compatible)
```js
Task.category?: string                 // id de categoría; ausente en tareas antiguas
Task.blocks[i].difficulty?: "facil"|"moderada"|"intermedia"|"desafio"|"hardcore"
Task.blocks[i].focusIntent?: string    // ≤ 200
Task.blocks[i].outcome?: { status: "completed"|"not_completed", points: int, resolvedAt: ISO, source: "user"|"timeout" }
users/{uid}/categories/{id}: { name, color, userId, createdAt, updatedAt }
```
**Sin duplicados:** no hay contadores. Cada bloque guarda su resultado una vez (el servicio rechaza un segundo intento y los clics simultáneos) y los totales se suman al leer (`pointsSummary`). Recargar o recibir dos veces el mismo evento no cambia el total.
Si dos dispositivos responden el mismo bloque a la vez, gana la última escritura: puede cambiar *qué* resultado queda, pero nunca se suman dos.

## Reglas Firestore
- `category` añadido al `hasOnly` de tareas (texto de 1 a 64 caracteres).
- Bloque nuevo `match /users/{uid}/categories/{categoryId}` con `isValidCategory`.
- Se conservan los campos Pomodoro y el bloque de perfil (`displayName`, `photo`).
- Los campos por bloque viven dentro de `blocks` (lista), que las reglas no inspeccionan, así que no requieren cambios.
- **Publicar:** `firebase deploy --only firestore:rules` desde esta rama (contiene todo lo anterior).
- **Al fusionar `feacture/FuncionalidadProfile`:** su `firestore.rules` no tiene los campos Pomodoro ni `category`; quédate con la versión de esta rama.

## Archivos
**Nuevos:**
- Dominio: `domain/{difficulty,block-outcome,category,stats,task-extensions}.js`
- Aplicación: `application/{category-repository,category.service,block-outcome.service,block-end-watcher.service}.js`
- Infraestructura: `infrastructure/memory/category.memory.repository.js` y `infrastructure/firebase/category.firestore.repository.js`
- Presentación: `presentation/tasks/{difficulty-select,category,block-intent,block-end}.ui.js`
- Tests: `tests/unit/{difficulty-points,category-stats,task-extensions,block-lifecycle}.test.js`

**Modificados (cambios puntuales):**
- `domain/task.js`: `buildTaskData` deja pasar `category` y `difficulty`; `cloneTask` copia `outcome`.
- `application/task.service.js`: valida las extensiones; `updateBlock` conserva los campos del bloque y acepta `blockChanges`; `addBlock` acepta `blockFields`.
- `firestore.rules` y su copia en `tests/unit/regression/fakes/firebase-firestore.js`.
- `index.html`: campos, diálogos, la campanita y `?v=` del CSS.
- `components.css`: solo se agregan reglas al final.
- `main.js`: conexión de servicios y envoltorio `startBlock`.
- `calendar-task-dialog.ui.js`, `task-form.ui.js`, `task-detail-dialog.ui.js` y `task-list.view.js` (parámetro final opcional `extras`).

**No tocados:** Pomodoro (servicios y UI), calendario (`calendar.*`), autenticación, sesión, navegación, recordatorios y configuración de Firebase.

## Pruebas
- `npm test`: 107 de 110, igual en Bogotá, Madrid, Kolkata, Auckland y UTC. Los 3 fallos ya existían antes de estos cambios:
  - `calendar.test.js` (2): esperan los eventos 25/5 que se quitaron del mapper.
  - `deploy-config.test.js` (1): `firebase.config.js` está versionado.
- Regresión contra `Desarrollo`: idéntica en los 8 escenarios × 2 zonas horarias. Se ignoraron los campos nuevos y las marcas de tiempo, y se rellenaron los selectores obligatorios. Para correrla hizo falta corregir el arnés en una copia, porque ya tenía tres problemas:
  - la ruta de `npm run test:regression`;
  - la falta de `MutationObserver`;
  - escenarios que buscan botones que la lista ya no tiene.
- E2E en Chromium (modo demo, reloj simulado): 32 de 32 comprobaciones. Cubren creación con categoría y dificultad, niveles deshabilitados, categorías propias y su reasignación a Ocio, intención al iniciar, aviso al terminar, paso a la campanita a los 3 minutos, respuesta desde la campanita, recarga sin duplicados, penalización por 24 h, tareas antiguas intactas y vista móvil.

## Pendiente / a revisar
- Probar contra Firebase real: el entorno de desarrollo no llega a `gstatic` ni al emulador.
- Eliminar un bloque con resultado también borra sus puntos (`removeBlock` no se tocó). Habría que decidir si se bloquea.
- La penalización por 24 h solo se aplica cuando la app está abierta en algún dispositivo (no hay servidor).
- Renombrar categorías no está implementado (no se pidió).
