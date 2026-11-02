/**
 * COORDINACIÓN DE SESIÓN: conecta los cambios de autenticación con la carga de datos.
 *   sin sesión  → repositorio demo (memoria)
 *   con sesión  → repositorio Firestore del usuario
 *
 * Controla cambios rápidos de sesión: si llega un cambio nuevo mientras el anterior aún carga,
 * el anterior ya no puede ocultar el indicador de carga ni mostrar errores (y task.service
 * descarta sus datos). No conoce el DOM: comunica todo mediante callbacks.
 *
 * @param {Object} deps
 * @param {{ onAuthChange: (cb: (user: {uid: string, email: string}|null) => void) => Promise<() => void> }} deps.auth
 * @param {ReturnType<import("./task.service.js").createTaskService>} deps.taskService
 * @param {(uid: string) => import("./task-repository.js").TaskRepository} deps.createUserRepository
 * @param {() => import("./task-repository.js").TaskRepository} deps.createGuestRepository
 * @param {(user: {uid: string, email: string}|null) => void} deps.onUserChanged
 * @param {(isLoading: boolean) => void} deps.onLoadingChange
 * @param {(error: Error) => void} deps.onLoadError
 */
export function createSessionCoordinator({ auth, taskService, createUserRepository, createGuestRepository, onUserChanged, onLoadingChange, onLoadError }) {
  let latestChange = 0;

  async function handleAuthChange(user) {
    const change = ++latestChange;
    onUserChanged(user);
    onLoadingChange(true);
    try {
      await taskService.useRepository(user ? createUserRepository(user.uid) : createGuestRepository());
    } catch (error) {
      if (change === latestChange) onLoadError(error);
    } finally {
      if (change === latestChange) onLoadingChange(false);
    }
  }

  return {
    /**
     * Empieza a escuchar la sesión.
     * @returns {Promise<() => void>} función para dejar de escuchar
     * @throws {Error} si la autenticación no está disponible (ej. Firebase sin configurar)
     */
    start: () => auth.onAuthChange(handleAuthChange),
  };
}
