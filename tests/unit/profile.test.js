import { test } from "node:test";
import assert from "node:assert/strict";
import { PROFILE_LIMITS, validateProfile, buildProfileData } from "../../public/src/domain/profile.js";
import { createProfileService } from "../../public/src/application/profile.service.js";

test("validateProfile acepta un nombre sin foto", () => assert.deepEqual(validateProfile({ displayName: "Ana" }), []));

test("validateProfile: el nombre es obligatorio y tiene máximo", () => {
  assert.deepEqual(validateProfile({ displayName: "  " }), ["El nombre es obligatorio."]);
  assert.deepEqual(
    validateProfile({ displayName: "a".repeat(PROFILE_LIMITS.nameMax + 1) }),
    [`El nombre no puede superar ${PROFILE_LIMITS.nameMax} caracteres.`]
  );
});

test("validateProfile: la foto es opcional, pero debe ser una imagen pequeña", () => {
  assert.deepEqual(validateProfile({ displayName: "Ana", photo: null }), []);
  assert.deepEqual(validateProfile({ displayName: "Ana", photo: "hola" }), ["La foto no es válida."]);
  const huge = "data:image/jpeg;base64," + "A".repeat(PROFILE_LIMITS.photoMax);
  assert.deepEqual(validateProfile({ displayName: "Ana", photo: huge }), ["La foto es demasiado grande."]);
});

test("buildProfileData recorta el nombre y deja la foto en null si falta", () => {
  assert.deepEqual(buildProfileData({ displayName: "  Ana  " }), { displayName: "Ana", photo: null });
});

const fakeRepo = (stored) => ({
  get: async () => stored,
  save: async (data) => ({ ...data, createdAt: "2026-11-02T10:00:00.000Z" }),
});

test("profile.service: una cuenta nueva guarda el perfil pendiente al abrir sesión", async () => {
  const service = createProfileService();
  service.setPending({ displayName: " Ana ", photo: null });
  await service.useRepository(fakeRepo(null));
  assert.equal(service.getProfile().displayName, "Ana");
});

test("profile.service: un usuario con perfil no se sobrescribe y cerrar sesión lo vacía", async () => {
  const service = createProfileService();
  service.setPending({ displayName: "Otro" });
  await service.useRepository(fakeRepo({ displayName: "Ana", photo: null }));
  assert.equal(service.getProfile().displayName, "Ana");
  await service.useRepository(null);
  assert.equal(service.getProfile(), null);
});