/**
 * ESM loader hook: stub `server-only` so recruitment services can run under tsx.
 * Used via: tsx --import ./prisma/recruitment-demo/register-hooks.mjs …
 */
import { register } from "node:module";

register("./server-only-hook.mjs", import.meta.url);
