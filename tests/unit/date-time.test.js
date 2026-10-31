import { test } from "node:test";
import assert from "node:assert/strict";
import {
  localInputToIso, dateToLocalInputValue, dateToIso, formatMinutesSeconds, startOfWeekMonday, MS_PER_HOUR,
} from "../../public/src/shared/date-time.js";

test("input local → ISO → input local es idempotente (cualquier zona horaria)", () => {
  for (const value of ["2026-11-04T10:00", "2026-03-29T01:30", "2026-10-25T23:59", "2026-01-01T00:00"]) {
    assert.equal(dateToLocalInputValue(new Date(localInputToIso(value))), value);
  }
});

test("localInputToIso interpreta la hora como local y devuelve UTC", () => {
  const iso = localInputToIso("2026-11-04T10:00");
  assert.match(iso, /^\d{4}-\d\d-\d\dT\d\d:\d\d:00\.000Z$/);
  assert.equal(new Date(iso).getHours(), 10);
});

test("localInputToIso devuelve null con el campo vacío", () => {
  assert.equal(localInputToIso(""), null);
  assert.equal(localInputToIso(undefined), null);
});

test("dateToIso usa UTC", () => {
  assert.equal(dateToIso(new Date(Date.UTC(2026, 10, 2, 14))), "2026-11-02T14:00:00.000Z");
});

test("formatMinutesSeconds", () => {
  assert.equal(formatMinutesSeconds(1500), "25:00");
  assert.equal(formatMinutesSeconds(299), "04:59");
  assert.equal(formatMinutesSeconds(0), "00:00");
});

test("startOfWeekMonday devuelve el lunes 00:00 local", () => {
  for (const day of [2, 3, 4, 5, 6, 7, 8]) { // 2 nov 2026 es lunes; 8 es domingo
    const monday = startOfWeekMonday(new Date(2026, 10, day, 15, 30));
    assert.deepEqual([monday.getFullYear(), monday.getMonth(), monday.getDate(), monday.getDay(), monday.getHours()], [2026, 10, 2, 1, 0]);
  }
});

test("MS_PER_HOUR", () => assert.equal(MS_PER_HOUR, 3_600_000));
