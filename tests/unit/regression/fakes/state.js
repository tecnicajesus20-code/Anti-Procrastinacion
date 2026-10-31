// Estado compartido del Firebase falso (sobrevive a "recargas" dentro del mismo proceso).
const g = globalThis;
g.__fake ??= { users: new Map(), current: null, listeners: new Set(), docs: new Map(), nextId: 1, delays: {}, failNext: null };
export const fake = g.__fake;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
