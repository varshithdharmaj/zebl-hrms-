/**
 * Resolve hook — map `server-only` to an empty module.
 */
import { pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const EMPTY = pathToFileURL(join(__dirname, "empty-server-only.mjs")).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return { shortCircuit: true, url: EMPTY };
  }
  return nextResolve(specifier, context);
}
