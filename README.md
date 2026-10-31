# MUVENAPP — Sistema Antiprocrastinación

Aplicación web para planificar tareas en bloques de tiempo, verlas en un calendario y trabajar con un temporizador Pomodoro. Las tareas se guardan en memoria (modo demo) o en Cloud Firestore por usuario (con sesión).

**La app no usa npm ni build**: son archivos estáticos en `public/`. npm solo se usa para las pruebas.

## Ejecutar en local

Necesitas internet (FullCalendar y Firebase se cargan desde CDN) y un servidor estático. Los módulos ES **no funcionan abriendo `index.html` con doble clic**.

```bash
# desde la raíz del repositorio, cualquiera de estas opciones:
python -m http.server 8080 --directory public   # → http://localhost:8080
npx serve public
firebase serve --only hosting                   # usa firebase.json
```
Con VS Code: Live Server sobre `public/index.html`.

Sin configurar Firebase la app funciona en **modo demo** (tres tareas de ejemplo, datos en memoria que se pierden al recargar) y el formulario de cuenta queda desactivado con un aviso.

> Usa `localhost` o `https://`. Por IP local con `http://` (p. ej. `http://192.168.x.x`) la creación de tareas en modo demo falla porque `crypto.randomUUID` exige un contexto seguro.

## Configurar Firebase

1. Copia `public/src/config/firebase.config.example.js` como `public/src/config/firebase.config.js`. La plantilla ya contiene la configuración del proyecto `muven-antiprocrastinacion`; para otro proyecto, sustituye los valores.
2. Ese archivo está en `.gitignore`: **no se sube a Git**. La configuración web de Firebase no es secreta; la seguridad real la dan las reglas de Firestore.
3. En Firebase Console: Authentication → proveedor **Correo/contraseña** activado; Firestore creado.
4. Recarga: crea una cuenta y tus tareas se guardarán en `users/{uid}/tasks`.

## Desplegar

```bash
firebase deploy                         # hosting + reglas + índices
firebase deploy --only hosting
firebase deploy --only firestore:rules
```
`firebase.json` publica `public/` en el sitio `muvenapp-antiprocrastinacion` y toma las reglas de `firestore.rules` **en la raíz** (antes estaban en `public/`, ver `docs/AUDITORIA.md`, AUD-03). Asegúrate de tener `public/src/config/firebase.config.js` antes de desplegar.

## Pruebas

```bash
npm install                 # solo la primera vez (jsdom y FullCalendar para pruebas)
npm test                    # unitarias y de arquitectura (sin dependencias)
npm run test:regression     # compara el comportamiento con la rama Desarrollo
```
Resultados, cobertura y límites en `docs/TESTING.md`.

## Estructura

```
firebase.json, .firebaserc       Despliegue (sin cambios salvo la ruta de las reglas)
firestore.rules                  Aislamiento por usuario y validación de tareas
firestore.indexes.json
public/                          Lo que se publica
  index.html                     Solo etiquetas, clases (CSS) e ids (JS)
  src/main.js                    Punto de entrada: crea y conecta los módulos
  src/config/                    Configuración de Firebase (plantilla; la real no está en Git)
  src/domain/                    Modelo y reglas (tareas, Pomodoro). Sin dependencias
  src/application/               Casos de uso, contrato de repositorio, sesión, temporizador
  src/infrastructure/            Firebase (auth, Firestore) y repositorio en memoria
  src/presentation/              Formularios, lista, calendario, Pomodoro y cuenta
  src/shared/                    Fechas, DOM y mensajes
  src/styles/                    CSS (diseño congelado)
tests/unit/                      Pruebas unitarias y de arquitectura (node:test)
tests/regression/                Arnés de regresión (jsdom + FullCalendar + Firebase falso)
docs/                            Documentación técnica
```

## Documentación

| Documento | Contenido |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Capas, responsabilidades, flujos y cómo añadir funcionalidades |
| [docs/MODULES.md](docs/MODULES.md) | Cada módulo y su contrato público |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | Estructura de Firestore y reglas |
| [docs/DEPENDENCIES.md](docs/DEPENDENCIES.md) | Relaciones entre módulos y dependencias externas |
| [docs/TESTING.md](docs/TESTING.md) | Pruebas y resultados |
| [docs/AUDITORIA.md](docs/AUDITORIA.md) | Hallazgos de la auditoría y su estado |
| [README_PROVISIONAL_DISENO.md](README_PROVISIONAL_DISENO.md) | Errores visuales pendientes de decisión de diseño |
| [docs/PROPUESTA_INTEGRACION_FIREBASE.md](docs/PROPUESTA_INTEGRACION_FIREBASE.md) | Propuesta original de integración (histórico) |

## Reglas del equipo

- HTML solo con etiquetas; estilos con **clases**; JS se engancha con **ids** (`byId`).
- La lógica de negocio va en `domain/` y `application/`; la interfaz no decide reglas ni habla con Firebase.
- Todo cambio de tareas pasa por `taskService`. Fechas siempre en ISO 8601 (conversiones solo en `shared/date-time.js`).
- Comentarios en español: qué hace cada archivo y cada función pública.
- `npm test` y `npm run test:regression` antes de abrir un merge.

## Versiones fijadas

| Librería | Versión | Dónde se declara |
|---|---|---|
| FullCalendar (paquete completo) | 6.1.15 | `<script>` en `public/index.html` y `package.json` (pruebas) |
| Firebase JS SDK (app, auth, firestore) | 10.14.1 | `FIREBASE_VERSION` en `src/infrastructure/firebase/firebase.client.js` |

Si se actualiza una versión, actualizarla en ambos sitios y volver a ejecutar las pruebas.
