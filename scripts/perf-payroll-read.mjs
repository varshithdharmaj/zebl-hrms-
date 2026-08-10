/**
 * Read-only warm-path timing for payroll page (no writes).
 * Run: node scripts/perf-payroll-read.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import pg from "pg";

function loadEnvFile(filename) {
  const path = resolve(process.cwd(), filename);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local");

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 20_000,
});

async function main() {
  const client = await pool.connect();
  try {
    const t0 = performance.now();
    const [active, summaries] = await Promise.all([
      client.query("select count(*)::int as c from employees where is_active = true"),
      client.query(
        `select count(*)::int as c from payroll_attendance_summaries s
         join employees e on e.id = s.employee_id
         where e.is_active = true`
      ),
    ]);
    const ensureCheckMs = Math.round(performance.now() - t0);

    const t1 = performance.now();
    await client.query(
      `select s.id, s.shortfall_minutes, e.name
       from payroll_attendance_summaries s
       join employees e on e.id = s.employee_id
       where e.is_active = true
       order by s.shortfall_minutes desc, e.name asc
       limit 500`
    );
    const listMs = Math.round(performance.now() - t1);

    const t2 = performance.now();
    await Promise.all([
      client.query(
        `select count(*)::int as c from payroll_attendance_summaries s
         join employees e on e.id = s.employee_id where e.is_active = true`
      ),
      client.query(
        `select coalesce(sum(s.ot_minutes),0)::int as ot,
                coalesce(sum(s.shortfall_minutes),0)::int as shortfall
         from payroll_attendance_summaries s
         join employees e on e.id = s.employee_id where e.is_active = true`
      ),
    ]);
    const cardsMs = Math.round(performance.now() - t2);

    console.log(
      JSON.stringify(
        {
          activeEmployees: active.rows[0].c,
          summaryRows: summaries.rows[0].c,
          ensureCheckMs,
          listMs,
          cardsMs,
          warmPageApproxMs: ensureCheckMs + Math.max(listMs, cardsMs),
          note: "Warm path after ensure short-circuit (no recompute writes)",
        },
        null,
        2
      )
    );
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await pool.end().catch(() => undefined);
  process.exit(1);
});
