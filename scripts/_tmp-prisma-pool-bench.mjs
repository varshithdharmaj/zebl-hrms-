import { register } from "node:module";
import { pathToFileURL } from "node:url";
register("./scripts/mock-server-only-register.mjs", pathToFileURL("./"));

const { prisma } = await import("../src/lib/prisma.ts");
const { resolveDatabasePoolMax } = await import("../src/lib/prisma-pool.ts");

const concurrency = Number.parseInt(process.env.BENCH_CONCURRENCY ?? "8", 10);
const rounds = Number.parseInt(process.env.BENCH_ROUNDS ?? "5", 10);

console.log(
  `Prisma concurrency bench (dev only) concurrency=${concurrency} rounds=${rounds} poolMax=${resolveDatabasePoolMax()}`
);
console.log("NOT HTTP TTFB. NOT a 100-user capacity claim.");

async function oneQuery() {
  const t0 = performance.now();
  await prisma.$queryRaw`SELECT 1`;
  return performance.now() - t0;
}

const samples = [];
let errors = 0;
for (let r = 0; r < rounds; r++) {
  const batch = await Promise.allSettled(Array.from({ length: concurrency }, () => oneQuery()));
  for (const item of batch) {
    if (item.status === "fulfilled") samples.push(item.value);
    else errors += 1;
  }
}

samples.sort((a, b) => a - b);
const p = (q) => samples[Math.min(samples.length - 1, Math.floor(q * (samples.length - 1)))] ?? 0;
console.log(
  JSON.stringify(
    {
      ok: samples.length,
      errors,
      p50_ms: Math.round(p(0.5)),
      p95_ms: Math.round(p(0.95)),
      max_ms: Math.round(samples[samples.length - 1] ?? 0),
    },
    null,
    2
  )
);

await prisma.$disconnect();
