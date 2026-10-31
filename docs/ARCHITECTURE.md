# Arquitectura

MUVENAPP es una SPA estática con módulos ES, sin build. La arquitectura separa **qué es una tarea** (dominio), **qué se puede hacer con ella** (aplicación), **dónde se guarda** (infraestructura) y **cómo se ve** (presentación). Se eligió la estructura más simple que permite crecer sin mezclar esas cuatro cosas.

## Capas

```
public/src/
├── main.js            Raíz de composición: crea todos los objetos y los conecta. Único sitio que conoce todas las capas.
├── domain/            QUÉ ES. Modelo, validación y reglas de estado. Sin imports.
├── application/       QUÉ SE PUEDE HACER. Casos de uso, contrato de persistencia, coordinación de sesión, temporizador.
├── infrastructure/    DÓNDE Y CON QUÉ. Firebase (SDK, auth, Firestore) y almacenamiento en memoria.
├── presentation/      CÓMO SE VE. Formularios, lista, adaptador de FullCalendar, Pomodoro y cuenta.
├── shared/            Utilidades transversales: fechas, acceso al DOM, mensajes.
├── config/            Configuración de Firebase (la real es local y no está en Git).
└── styles/            CSS del equipo de diseño.
```

| Capa | Puede importar | No debe | Comprobado por |
|---|---|---|---|
| `domain` | nada | DOM, Firebase, FullCalendar, temporizadores | `architecture.test.js`, `domain.test.js` |
| `application` | `domain` | DOM, Firebase | `architecture.test.js` |
| `infrastructure` | `domain`, `shared` | DOM, reglas de negocio | `architecture.test.js` |
| `presentation` | `domain`, `shared` | Firebase, repositorios | `architecture.test.js` |
| `shared` | `shared` | otras capas | `architecture.test.js` |
| `main.js` | todas | lógica propia más allá de conectar | revisión |

La presentación recibe los casos de uso **como parámetro** desde `main.js`; no los importa. Por eso no hay flechas de `presentation` a `application` en el grafo (las referencias en JSDoc son solo tipos).

## Flujos principales

**Crear una tarea (lista o calendario).** Ambos formularios leen sus campos con `presentation/tasks/task-input.js` (fechas locales → ISO) y llaman al mismo caso de uso:
```
task-form.ui / calendar-task-dialog.ui
  → taskService.add(input)
      → domain.buildTaskData (normaliza) → domain.validateTask (valida)
      → repository.create(data)
      → notify → task-list.view.render + calendar.view.render
  → runAction: éxito = limpia mensaje · error = lo muestra
```

**Mover o redimensionar en el calendario.**
```
FullCalendar eventDrop/eventResize → calendar.view → calendar.mapper.eventToBlock (Date → ISO)
  → main: taskService.moveBlock(id, start, end) → validación → repository.update
  → si falla: mensaje de error + info.revert() (el evento vuelve a su sitio)
```

**Cambio de sesión.**
```
Firebase onAuthStateChanged → firebase-auth.onAuthChange → session.coordinator
  → auth.ui.setUser(user), setLoading(true)
  → taskService.useRepository(user ? Firestore(uid) : memoria demo)
  → solo el cambio más reciente controla "Cargando…" y los errores
```

## Aislamiento entre sesiones

Firebase no espera a los callbacks asíncronos, así que dos cambios de sesión pueden solaparse. Dos mecanismos lo controlan (AUD-01):

1. **Cargas:** cada `useRepository`/`load` recibe un ticket. Al terminar, si ya empezó otra carga, el resultado (o el error) se descarta.
2. **Escrituras:** cada escritura recuerda contra qué repositorio empezó. Si al terminar ese repositorio ya no es el activo, el dato se guarda donde correspondía, pero no se mezcla con el estado de la sesión nueva.

La seguridad real entre usuarios la dan las **reglas de Firestore** (`request.auth.uid == uid`); el cliente solo evita mostrar datos ajenos en el mismo dispositivo.

## Decisiones (y por qué)

- **Sin `dependency-container.js` ni `bootstrap.js`.** Con un solo punto de composición de unas 90 líneas, un contenedor sería una capa artificial. `main.js` hace de contenedor explícito.
- **`main.js` no se movió a `app/`.** `index.html` lo carga por ruta; moverlo obligaba a tocar el HTML congelado.
- **`config/` no se movió.** `firebase.config.js` existe solo en las máquinas del equipo; moverlo rompería el despliegue de quien no actualice su copia. Solo se movió el cargador, con la ruta relativa ajustada.
- **Inyección de dependencias por parámetros con valores por defecto** (`getFirebase`, `clock`), en lugar de un framework: basta para probar todo aislado.
- **Sin clases ni patrones adicionales.** Fábricas de funciones y objetos literales, igual que el código original.
- **Pomodoro independiente de tareas.** No comparten estado ni imports.

## Cómo añadir una funcionalidad

1. **Regla o dato nuevo de la tarea** → `domain/task.js` (contrato y validación) y, si se guarda, `firestore.rules` + el Firebase falso de `tests/regression/fakes/firebase-firestore.js`.
2. **Acción nueva** → caso de uso en `application/task.service.js` (o un servicio nuevo en `application/`).
3. **Persistencia nueva** → implementar el contrato de `application/task-repository.js` en `infrastructure/` y añadirlo a la batería de `tests/unit/repositories.test.js`.
4. **Pantalla nueva** → HTML con clases en `index.html`, estilos en `styles/`, comportamiento en `presentation/`.
5. **Conectar** en `main.js`.
6. `npm test` + `npm run test:regression`. Si un cambio de comportamiento es intencionado, declararlo en `EXPECTED_DIFFS` de `tests/regression/compare.mjs` con su justificación.
