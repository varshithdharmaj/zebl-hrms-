/**
 * One-off / CI-friendly DB latency baseline. No credentials logged.
 * Run: node scripts/perf-baseline.mjs
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

const url = process.env.DATABASE_URL?.trim() ?? "";
if (!url) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

const host = (() => {
  try {
    return new URL(url.replace(/^postgres:\/\//, "postgresql://")).hostname;
  } catch {
    return "unknown";
  }
})();

const pool = new pg.Pool({
  connectionString: url,
  max: 1,
  connectionTimeoutMillis: 20_000,
});

async function main() {
  const tConnect = performance.now();
  const client = await pool.connect();
  const connectMs = Math.round(performance.now() - tConnect);

  const tPing = performance.now();
  await client.query("select 1");
  const pingMs = Math.round(performance.now() - tPing);

  async function timedCount(label, sql) {
    const started = performance.now();
    try {
      const res = await client.query(sql);
      return {
        label,
        count: res.rows[0].c,
        ms: Math.round(performance.now() - started),
        ok: true,
      };
    } catch (error) {
      return {
        label,
        count: null,
        ms: Math.round(performance.now() - started),
        ok: false,
        error: error instanceof Error ? error.message : "error",
      };
    }
  }

  const counts = [
    await timedCount("employees", "select count(*)::int as c from employees"),
    await timedCount(
      "activeEmployees",
      "select count(*)::int as c from employees where is_active = true"
    ),
    await timedCount(
      "attendanceRecords",
      "select count(*)::int as c from attendance_records"
    ),
    await timedCount("leaveRequests", "select count(*)::int as c from leave_requests"),
    await timedCount("candidates", "select count(*)::int as c from candidates"),
    await timedCount(
      "applications",
      "select count(*)::int as c from recruitment_applications"
    ),
    await timedCount(
      "interviews",
      "select count(*)::int as c from recruitment_interviews"
    ),
    await timedCount("offers", "select count(*)::int as c from recruitment_offers"),
    await timedCount("tickets", "select count(*)::int as c from tickets"),
    await timedCount(
      "payrollSummaries",
      "select count(*)::int as c from payroll_attendance_summaries"
    ),
    await timedCount(
      "attendanceLast35d",
      `select count(*)::int as c from attendance_records
       where attendance_date >= (current_date - interval '35 days')
         and attendance_date <= current_date`
    ),
  ];

  const tSeq = performance.now();
  for (let i = 0; i < 20; i++) await client.query("select 1");
  const twentyRoundTripsMs = Math.round(performance.now() - tSeq);

  const active = counts.find((c) => c.label === "activeEmployees" && c.ok)?.count ?? 0;
  const sampleN = Math.min(Number(active) || 0, 50);
  const tUpsertSim = performance.now();
  for (let i = 0; i < sampleN; i++) {
    await client.query("select 1");
  }
  const sequentialUpsertSimMs = Math.round(performance.now() - tUpsertSim);

  console.log(
    JSON.stringify(
      {
        host,
        connectMs,
        pingMs,
        twentyRoundTripsMs,
        avgRoundTripMs: Math.round(twentyRoundTripsMs / 20),
        counts,
        payrollSequentialUpsertSimulation: {
          sampleN,
          sequentialUpsertSimMs,
          projectedForAllActiveMs:
            sampleN > 0 ? Math.round((sequentialUpsertSimMs / sampleN) * Number(active)) : 0,
          note: "Projected from SELECT 1 RTT only; real upserts are heavier. Double when cards+table recompute twice.",
        },
      },
      null,
      2
    )
  );

  client.release();
  await pool.end();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await pool.end().catch(() => undefined);
  process.exit(1);
});
