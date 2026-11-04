/**
 * CASOS DE USO DEL PERFIL (users/{uid}). No toca el DOM ni conoce Firebase: trabaja con un repositorio
 * { get(), save(data) }.
 *
 * API pública:
 *   setPending(input)        Datos elegidos al registrarse; se guardan al abrir la sesión si no hay perfil
 *   useRepository(repo|null) Cambia de usuario (null = sin sesión) y carga su perfil
 *   update(input)            Edita nombre y foto. El correo NO forma parte del perfil: es de Firebase Auth.
 *   getProfile() / subscribe(callback)
 *
 * Aislamiento: si la sesión cambia mientras se guarda, el resultado no se mezcla con el nuevo usuario.
 */
import { buildProfileData, validateProfile } from "../domain/profile.js";

export function createProfileService() {
  let profile = null;
  let pending = null;
  let repository = null;
  let latestLoad = 0;
  const listeners = new Set();
  const emit = () => listeners.forEach((callback) => callback(profile));

  return {
    setPending(input) {
      pending = input ? buildProfileData(input) : null;
    },

    async useRepository(nextRepository) {
      const load = ++latestLoad;
      const toSave = pending;
      pending = null;
      repository = nextRepository ?? null;
      profile = null;
      emit();
      if (!nextRepository) return;

      let loaded = await nextRepository.get();
      if (!loaded && toSave) {
        const [problem] = validateProfile(toSave);
        if (problem) throw new Error(problem);
        loaded = await nextRepository.save(toSave);
      }
      if (load === latestLoad) {
        profile = loaded;
        emit();
      }
    },

    /**
     * Guarda nombre y foto del usuario con sesión. Conserva la fecha de alta (la gestiona el repositorio).
     * @param {{displayName: string, photo?: string|null}} input
     */
    async update(input) {
      if (!repository) throw new Error("Inicia sesión para editar tu perfil.");
      const data = buildProfileData(input);
      const [problem] = validateProfile(data);
      if (problem) throw new Error(problem);
      const target = repository;
      const load = latestLoad;
      const saved = await target.save(data);
      if (target === repository && load === latestLoad) {
        profile = saved;
        emit();
      }
      return saved;
    },

    getProfile: () => profile,

    subscribe(callback) {
      listeners.add(callback);
      callback(profile);
      return () => listeners.delete(callback);
    },
  };
}
