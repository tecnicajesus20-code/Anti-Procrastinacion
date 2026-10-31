const login = async (a, email, pw = "secret1") => { a.set("auth-email", email); a.set("auth-password", pw); a.click("auth-login"); await a.settle(80); };
const register = async (a, email, pw = "secret1") => { a.set("auth-email", email); a.set("auth-password", pw); a.click("auth-register"); await a.settle(80); };
const fillTask = (a, { title, desc = "", start, end, due = "" }) => {
  a.set("task-title", title); a.set("task-description", desc); a.set("task-start", start); a.set("task-end", end); a.set("task-due", due);
};
const local = (s) => new Date(s); // interpretación local, como un input datetime-local

export const scenarios = {
  async demo(a) {
    a.step("carga inicial");
    // Crear desde la lista
    fillTask(a, { title: "  Tarea lista  ", desc: "  desc  ", start: "2026-11-04T10:00", end: "2026-11-04T11:30", due: "2026-11-06T18:00" });
    a.submit("task-form"); await a.settle(); a.step("crear desde lista");
    // Inválida: fin antes de inicio
    fillTask(a, { title: "Mala", start: "2026-11-04T12:00", end: "2026-11-04T11:00" });
    a.submit("task-form"); await a.settle(); a.step("crear inválida (fin<inicio)");
    // Título solo espacios (required no lo bloquea)
    fillTask(a, { title: "   ", start: "2026-11-04T12:00", end: "2026-11-04T13:00" });
    a.submit("task-form"); await a.settle(); a.step("crear título vacío");
    // Crear desde calendario
    a.selectSlot(local("2026-11-05T08:00"), local("2026-11-05T09:30")); await a.settle(); a.step("seleccionar hueco");
    a.set("event-title", "Desde calendario"); a.set("event-description", " nota ");
    a.submit("event-form"); await a.settle(); a.step("guardar desde calendario");
    // Cancelar y cerrar diálogo
    a.selectSlot(local("2026-11-05T12:00"), local("2026-11-05T13:00")); await a.settle();
    a.set("event-title", "no se guarda"); a.click("event-dialog-cancel"); await a.settle(); a.step("cancelar diálogo");
    a.selectSlot(local("2026-11-05T14:00"), local("2026-11-05T15:00")); await a.settle();
    a.click("event-dialog-close"); await a.settle(); a.step("cerrar diálogo con ×");
    // Diálogo con título vacío
    a.selectSlot(local("2026-11-05T16:00"), local("2026-11-05T17:00")); await a.settle();
    a.set("event-title", "   "); a.submit("event-form"); await a.settle(); a.step("diálogo título vacío");
    a.click("event-dialog-cancel");
    // Completar / reabrir / eliminar
    a.clickListButton("Tarea lista", "Completar"); await a.settle(); a.step("completar");
    a.clickListButton("Tarea lista", "Reabrir"); await a.settle(); a.step("reabrir");
    a.clickListButton("Entregar informe", "Completar"); await a.settle(); a.step("completar in_progress");
    a.clickListButton("Desde calendario", "Eliminar"); await a.settle(); a.step("eliminar");
    // Mover y redimensionar
    const r1 = await a.moveEvent("Tarea lista", local("2026-11-06T09:00"), local("2026-11-06T10:30"));
    a.step("mover evento (revert=" + r1 + ")");
    const r2 = await a.moveEvent("Tarea lista", local("2026-11-06T09:00"), local("2026-11-06T12:00"), "eventResize");
    a.step("redimensionar (revert=" + r2 + ")");
    const r3 = await a.moveEvent("Tarea lista", local("2026-11-07T09:00"), null);
    a.step("mover sin end (revert=" + r3 + ")");
  },
  async pomodoro(a) {
    a.step("inicial");
    a.click("pomodoro-start"); a.tickSeconds(3); a.step("3s");
    a.click("pomodoro-start"); a.tickSeconds(1); a.step("doble start no acelera");
    a.click("pomodoro-pause"); a.tickSeconds(5); a.step("pausa");
    a.click("pomodoro-start"); a.tickSeconds(1496); a.step("fin trabajo -> descanso");
    a.tickSeconds(3); a.step("tras fin, detenido");
    a.click("pomodoro-start"); a.tickSeconds(300); a.step("fin descanso -> trabajo");
    a.click("pomodoro-start"); a.tickSeconds(10); a.click("pomodoro-reset"); a.tickSeconds(5); a.step("reset");
  },
  async mobile(a) { a.step("móvil"); },
  async firebaseFlow(a) {
    a.step("sin sesión con firebase");
    await login(a, "ana@x.com"); a.step("login inexistente");
    await register(a, "ana@x.com", "123"); a.step("registro contraseña débil");
    await register(a, "ana@x.com"); a.step("registro ok");
    fillTask(a, { title: "Ana 1", start: "2026-11-04T10:00", end: "2026-11-04T11:00" });
    a.submit("task-form"); await a.settle(); a.step("ana crea");
    a.selectSlot(local("2026-11-05T08:00"), local("2026-11-05T09:00")); await a.settle();
    a.set("event-title", "Ana cal"); a.submit("event-form"); await a.settle(); a.step("ana crea desde calendario");
    a.clickListButton("Ana 1", "Completar"); await a.settle(); a.step("ana completa");
    await a.moveEvent("Ana cal", local("2026-11-05T10:00"), local("2026-11-05T11:00")); a.step("ana mueve");
    a.fake.failNext = { op: "update", code: "unavailable", message: "Servicio no disponible" };
    const r = await a.moveEvent("Ana cal", local("2026-11-05T15:00"), local("2026-11-05T16:00")); a.step("mover con error firestore (revert=" + r + ")");
    a.fake.failNext = { op: "create", code: "unavailable", message: "Servicio no disponible" };
    fillTask(a, { title: "Falla", start: "2026-11-04T10:00", end: "2026-11-04T11:00" });
    a.submit("task-form"); await a.settle(); a.step("crear con error firestore");
    a.click("auth-logout"); await a.settle(80); a.step("logout");
    await register(a, "beto@x.com"); a.step("beto registra: no ve tareas de ana");
    a.click("auth-reset"); await a.settle(); a.step("recuperar contraseña");
    a.click("auth-logout"); await a.settle(80);
    await login(a, "ana@x.com", "mala"); a.step("ana contraseña mala");
    await login(a, "ana@x.com"); a.step("ana vuelve: persistencia");
    a.clickListButton("Ana cal", "Eliminar"); await a.settle(); a.step("ana elimina");
    a.fake.failNext = { op: "list", code: "unavailable", message: "Servicio no disponible" };
    a.click("auth-logout"); await a.settle(80);
    a.fake.failNext = { op: "list", code: "unavailable", message: "Servicio no disponible" };
    await login(a, "ana@x.com"); a.step("error al cargar tareas");
  },
  async reloadA(a) { await register(a, "carla@x.com"); fillTask(a, { title: "Persiste", start: "2026-11-04T10:00", end: "2026-11-04T11:00" }); a.submit("task-form"); await a.settle(); a.step("antes de recargar"); },
  async reloadB(a) { await a.settle(80); a.step("después de recargar (sesión persistida)"); },
  async race(a) {
    // Ana tiene tareas; su carga tarda 150 ms. Cierra sesión antes de que termine.
    await register(a, "ana@x.com");
    fillTask(a, { title: "Privada de Ana", start: "2026-11-04T10:00", end: "2026-11-04T11:00" }); a.submit("task-form"); await a.settle();
    a.click("auth-logout"); await a.settle(80);
    a.fake.delays["list:uid-ana"] = 150;
    a.set("auth-email", "ana@x.com"); a.set("auth-password", "secret1"); a.click("auth-login");
    await a.settle(20);
    a.click("auth-logout");
    await a.settle(300);
    a.step("tras carrera login→logout");
  },
  async raceWrite(a) {
    // Una creación de Ana en vuelo cuando cierra sesión
    await register(a, "ana@x.com");
    a.fake.delays["create:uid-ana"] = 150;
    fillTask(a, { title: "En vuelo", start: "2026-11-04T10:00", end: "2026-11-04T11:00" }); a.submit("task-form");
    await a.settle(20);
    a.click("auth-logout");
    await a.settle(300);
    a.step("tras carrera crear→logout");
  },
};
