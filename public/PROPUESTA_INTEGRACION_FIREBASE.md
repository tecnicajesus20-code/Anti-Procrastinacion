# Propuesta de integración: Firebase Auth y Firestore

## 1. Flujo de autenticación y datos

El flujo de cinco pasos para la integración es:

1. El usuario se registra o inicia sesión con correo y contraseña mediante Firebase Authentication.
2. `onAuthStateChanged` detecta la sesión y entrega el usuario autenticado a la aplicación.
3. La aplicación selecciona el repositorio: modo memoria para la demo sin sesión y Firestore para el usuario autenticado.
4. Las operaciones de tareas (`list`, `create`, `update` y `delete`) se ejecutan en `users/{uid}/tasks/{taskId}`; la ruta queda asociada al `uid` autenticado.
5. Firestore valida cada operación con sus reglas de seguridad. Al cerrar sesión, la aplicación vuelve al repositorio de demostración.

## 2. Configuración y seguridad

La aplicación actual es estática y no utiliza Vite ni un proceso de compilación. Por eso, no puede leer directamente variables `VITE_*` desde `.env.local`. La configuración de Firebase se carga desde `src/config/firebase.config.js`, creado localmente a partir de `src/config/firebase.config.example.js`; el archivo real está excluido de Git.

Si el proyecto migra a Vite, se puede sustituir este mecanismo por un `.env.example` con estas variables:

```dotenv
VITE_FIREBASE_API_KEY=tu_api_key_aqui
VITE_FIREBASE_AUTH_DOMAIN=tu_proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tu_project_id
VITE_FIREBASE_APP_ID=tu_app_id
```

La configuración web de Firebase no debe considerarse un secreto. La protección de los datos depende de las reglas de Firestore y de comprobar que las operaciones corresponden al usuario autenticado.

## 3. Reglas de seguridad de Firestore

Las tareas se guardan en una colección anidada por usuario, no en una colección raíz `/tasks` con un campo `userId`. Las reglas del proyecto deben conservar esta ruta y validar el contrato de tarea definido en `src/modules/tasks/task.model.js`:

```text
match /users/{uid}/tasks/{taskId} {
  allow read, delete: if request.auth != null && request.auth.uid == uid;
  allow create, update: if request.auth != null
    && request.auth.uid == uid
    && isValidTask(request.resource.data);
}
```

La versión completa y desplegable está en `firestore.rules`.

## 4. Archivos y orden de implementación

El repositorio ya contiene la integración base. Los módulos equivalentes a la propuesta son:

1. `src/config/firebase.js`: carga e inicialización diferida del SDK de Firebase.
2. `src/modules/auth/auth.service.js`: registro, inicio y cierre de sesión, restablecimiento de contraseña y observación de cambios de sesión.
3. `src/modules/storage/firestore.repository.js`: lectura y operaciones CRUD de tareas en Firestore.
4. `src/modules/tasks/task.service.js`: validación y gestión de tareas usando la interfaz común del repositorio.
5. `src/main.js`: conecta el estado de autenticación con el repositorio activo.
6. `firestore.rules`: limita el acceso a las tareas del usuario y valida sus datos.

## 5. Pasos para probar

1. Clonar la rama de trabajo y configurar Firebase siguiendo `README.md`.
2. No es necesario ejecutar `npm install`: el proyecto carga Firebase desde CDN y no usa npm.
3. En Firebase Console, habilitar Authentication con correo/contraseña y crear Firestore.
4. Iniciar la aplicación desde un servidor estático local, registrar un usuario y crear o modificar tareas.
5. Confirmar en Firebase Console que el usuario aparece en Authentication y que sus tareas están bajo `users/{uid}/tasks`.
6. Probar con otra cuenta que no se puede acceder a las tareas del primer usuario.

La autenticación real, Firestore y las reglas requieren validación contra un proyecto Firebase configurado; no se pueden verificar solo con el modo demo.