import { buildProfileData, validateProfile } from "../domain/profile.js";

export function createProfileService() {
  let profile = null;
  let pending = null;
  let latestLoad = 0;
  const listeners = new Set();
  const emit = () => listeners.forEach((callback) => callback(profile));

  return {
    setPending(input) {
      pending = input ? buildProfileData(input) : null;
    },

    async useRepository(repository) {
      const load = ++latestLoad;
      const toSave = pending;
      pending = null;
      profile = null;
      emit();
      if (!repository) return;

      let loaded = await repository.get();
      if (!loaded && toSave) {
        const [problem] = validateProfile(toSave);
        if (problem) throw new Error(problem);
        loaded = await repository.save(toSave);
      }
      if (load === latestLoad) {
        profile = loaded;
        emit();
      }
    },

    getProfile: () => profile,

    subscribe(callback) {
      listeners.add(callback);
      callback(profile);
      return () => listeners.delete(callback);
    },
  };
}