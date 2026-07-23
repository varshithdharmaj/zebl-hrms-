import { copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const generatedInternalDir = join(
  process.cwd(),
  ".open-next",
  "server-functions",
  "default",
  "src",
  "generated",
  "prisma",
  "internal"
);
const sourceFile = (await readdir(generatedInternalDir)).find((file) =>
  /^query_(?:compiler|engine)_bg\.wasm$/.test(file)
);
if (!sourceFile) {
  throw new Error("No generated Prisma WASM module was found");
}
const sourcePath = join(generatedInternalDir, sourceFile);
const handlerPath = join(
  process.cwd(),
  ".open-next",
  "server-functions",
  "default",
  "handler.mjs"
);
const workerPath = join(process.cwd(), ".open-next", "worker.js");
const targetDir = join(process.cwd(), ".open-next", "static", "wasm");
const handler = await readFile(handlerPath, "utf8");
const worker = await readFile(workerPath, "utf8");
const hashes = [
  ...new Set(
    [...handler.matchAll(/\.v\([^,]+,[^,]+,"([a-f0-9]{16})"/g)].map(
      (match) => match[1]
    )
  ),
];

if (hashes.length === 0) {
  throw new Error("No server WASM references were emitted");
}

const canonicalHash = hashes[0];
let normalizedHandler = hashes
  .slice(1)
  .reduce((content, hash) => content.replaceAll(hash, canonicalHash), handler);

// Cloudflare Workers forbid WebAssembly.instantiate(ArrayBuffer).
// Inject CompiledWasm via worker.js (globalThis.__PRISMA_QUERY_COMPILER_WASM__)
// and expose it as { default: Module }, which Prisma's getQueryCompilerWasmModule expects.
const compiledWasmLoader =
  '=(a2,b3,c3,d2)=>Promise.resolve(globalThis.__PRISMA_QUERY_COMPILER_WASM__).then((m)=>{a2.default=m;return a2})';

const wasmLoaderCandidates = [
  // Original webpack fs.readFile + instantiate(ArrayBuffer) loader
  '=(a2,b3,c3,d2)=>new Promise(function(a3,b4){try{var{readFile:d3}=require("fs"),{join:e8}=require("path");d3(e8("","static/wasm/"+c3+".wasm"),function(c4,d4){if(c4)return b4(c4);a3({arrayBuffer:()=>d4})})}catch(a4){b4(a4)}}).then(a3=>a3.arrayBuffer()).then(a3=>WebAssembly.instantiate(a3,d2)).then(b4=>Object.assign(a2,b4.instance.exports))',
  // Intermediate instantiate(Module) loader
  '=(a2,b3,c3,d2)=>Promise.resolve(globalThis.__PRISMA_QUERY_COMPILER_WASM__).then((m)=>WebAssembly.instantiate(m,d2)).then((b4)=>Object.assign(a2,(b4.instance?b4.instance:b4).exports))',
];

let replaced = false;
for (const candidate of wasmLoaderCandidates) {
  if (normalizedHandler.includes(candidate)) {
    normalizedHandler = normalizedHandler.replaceAll(candidate, compiledWasmLoader);
    replaced = true;
  }
}

if (!replaced && !normalizedHandler.includes(compiledWasmLoader)) {
  throw new Error("Expected webpack WASM loader was not found in handler.mjs");
}

await writeFile(handlerPath, normalizedHandler);
await rm(targetDir, { recursive: true, force: true });
await mkdir(targetDir, { recursive: true });
await copyFile(sourcePath, join(targetDir, `${canonicalHash}.wasm`));
await rm(sourcePath, { force: true });

const wasmImportLine = `import __PRISMA_QUERY_COMPILER_WASM__ from "./static/wasm/${canonicalHash}.wasm";\nglobalThis.__PRISMA_QUERY_COMPILER_WASM__ = __PRISMA_QUERY_COMPILER_WASM__;\n`;
let nextWorker = worker;
if (!nextWorker.includes("__PRISMA_QUERY_COMPILER_WASM__")) {
  nextWorker = wasmImportLine + nextWorker;
}
nextWorker = nextWorker
  .split(/\r?\n/)
  .filter((line) => !line.includes("./.build/durable-objects/"))
  .join("\n");
await writeFile(workerPath, nextWorker);
await rm(join(process.cwd(), ".open-next", ".build", "durable-objects"), {
  recursive: true,
  force: true,
});
await rm(
  join(process.cwd(), ".open-next", "cloudflare", "cache-assets-manifest.sql"),
  { force: true }
);
await rm(
  join(
    process.cwd(),
    ".open-next",
    "server-functions",
    "default",
    ".next",
    "server",
    "pages",
    "404.html"
  ),
  { force: true }
);
