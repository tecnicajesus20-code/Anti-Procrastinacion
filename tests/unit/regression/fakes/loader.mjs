// Redirige las URLs del CDN de Firebase a los módulos falsos.
import { pathToFileURL } from "node:url";
const here = new URL("./", import.meta.url);
export async function resolve(specifier, context, next) {
  const m = specifier.match(/^https:\/\/www\.gstatic\.com\/firebasejs\/[\d.]+\/(firebase-(app|auth|firestore))\.js$/);
  if (m) return { url: new URL(`${m[1]}.js`, here).href, shortCircuit: true };
  return next(specifier, context);
}
