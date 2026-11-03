import { test } from "node:test";
import assert from "node:assert/strict";
import { PROFILE_LIMITS, validateProfile, buildProfileData } from "../../public/src/domain/profile.js";

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