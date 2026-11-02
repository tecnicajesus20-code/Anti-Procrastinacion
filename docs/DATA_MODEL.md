# Modelo de datos (Cloud Firestore)

Las tareas pueden tener varios bloques de tiempo. Los documentos antiguos sin `blocks` siguen siendo válidos y se interpretan como una tarea con un solo bloque.

## Ubicación

| Dato | Valor |
|---|---|
| Proyecto | `muven-antiprocrastinacion` (`.firebaserc`) |
| Base de datos | `(default)`, ubicación `nam5` (`firebase.json`) |
| Ruta | `users/{uid}/tasks/{taskId}` |
| `uid` | uid de Firebase Authentication |
| `taskId` | id automático de `addDoc` |
| Documento `users/{uid}` | **no existe**: solo se usa como prefijo de la subcolección |

## Documento de tarea

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `title` | string | sí | 1–120 caracteres (reglas); recortado en cliente |
| `description` | string \| null | no | `null` si está vacía |
| `status` | string | sí | `"pending"` \| `"in_progress"` \| `"done"` |
| `dueDate` | string \| null | no | ISO 8601 UTC |
| `start` | string | sí | ISO 8601 UTC, p. ej. `"2026-11-04T15:00:00.000Z"` |
| `end` | string | sí | ISO 8601 UTC, posterior a `start` |
| `blocks` | array de `{start, end}` | no, por compatibilidad | Horarios de la tarea; `start` y `end` reflejan el primer bloque |

- El **id no se guarda como campo**: es el id del documento (las reglas rechazan cualquier campo extra).
- `blocks` contiene al menos un bloque en tareas nuevas. Si falta en una tarea antigua, se usa su par `start`/`end`. Cada bloque representa un evento independiente en el calendario y todos comparten la misma tarea, descripción y estado.
- En una misma tarea los bloques no pueden repetir ni superponer horarios. Se pueden mover, editar y eliminar individualmente, pero no se puede borrar el último bloque sin eliminar también la tarea.
- El color se deriva del id de la tarea en la interfaz; por eso todos sus bloques comparten color y no se añade un campo de color a Firestore.
- Las fechas son **texto ISO, no `Timestamp`**. La comparación `end > start` de las reglas es textual y es correcta porque el cliente siempre genera el mismo formato (`Date#toISOString`). No hay conversiones de `Timestamp` en el código porque no se usan.

Ejemplo:
```json
{
  "title": "Estudiar para el parcial",
  "description": "Capítulos 3 y 4",
  "status": "pending",
  "dueDate": null,
  "start": "2026-11-04T14:00:00.000Z",
  "end": "2026-11-04T16:00:00.000Z",
  "blocks": [
    { "start": "2026-11-04T14:00:00.000Z", "end": "2026-11-04T16:00:00.000Z" },
    { "start": "2026-11-05T14:00:00.000Z", "end": "2026-11-05T15:00:00.000Z" }
  ]
}
```

## Reglas (`firestore.rules`, raíz del repositorio)

| Operación | Condición |
|---|---|
| `read`, `delete` | `request.auth.uid == uid` |
| `create`, `update` | dueño **y** `isValidTask(request.resource.data)` |
| Cualquier otra ruta | denegada (no hay regla comodín) |

`isValidTask` exige `title`, `status`, `start`, `end`; permite `blocks` como lista opcional además de `description` y `dueDate`; valida longitud del título, valores de `status`, que `start`/`end` sean texto y `end > start`.

## Índices
`firestore.indexes.json` vacío: la única consulta es leer la subcolección completa.

## Modo demo
Mismo contrato `Task`, en memoria (`infrastructure/memory/`). Los ids son `crypto.randomUUID()` (o `demo-1…3` para las tareas de ejemplo). No se persiste nada.

## Correspondencias
| Origen | Destino | Dónde |
|---|---|---|
| `<input type="datetime-local">` (hora local) | ISO UTC | `shared/date-time.js#localInputToIso` |
| `Date` de FullCalendar | ISO UTC | `presentation/calendar/calendar.mapper.js#eventToBlock` |
| `Task` | eventos de FullCalendar | `calendar.mapper.js#taskToEvents` (uno por cada bloque) |
| Documento Firestore | `Task` | `infrastructure/firebase/task.firestore.mapper.js` |
