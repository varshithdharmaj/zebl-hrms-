import "dotenv/config";
import pg from "pg";

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error(JSON.stringify({ ok: false, error: "No DATABASE_URL/DIRECT_URL" }));
  process.exit(1);
}

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
const version = (await client.query("SELECT version()")).rows[0].version.split(",")[0];
const indexes = (
  await client.query(`
    SELECT indexname
    FROM pg_indexes
    WHERE tablename = 'leave_transactions'
      AND (
        indexname LIKE 'leave_transactions_one%'
        OR indexname LIKE 'leave_transactions_system%'
      )
    ORDER BY indexname
  `)
).rows.map((r) => r.indexname);

const dupRequestType = (
  await client.query(`
    SELECT COUNT(*)::int AS groups
    FROM (
      SELECT leave_request_id, transaction_type
      FROM leave_transactions
      WHERE leave_request_id IS NOT NULL
      GROUP BY 1, 2
      HAVING COUNT(*) > 1
    ) d
  `)
).rows[0].groups;

const dupSystemAccrual = (
  await client.query(`
    SELECT COUNT(*)::int AS groups
    FROM (
      SELECT employee_id, reason
      FROM leave_transactions
      WHERE transaction_type = 'accrual'
        AND leave_request_id IS NULL
        AND reason IS NOT NULL
      GROUP BY 1, 2
      HAVING COUNT(*) > 1
    ) d
  `)
).rows[0].groups;

const mig = (
  await client.query(`
    SELECT migration_name
    FROM _prisma_migrations
    WHERE migration_name = '20260811140000_leave_transaction_idempotency'
  `)
).rows;

console.log(
  JSON.stringify(
    {
      ok: true,
      version,
      migrationApplied: mig.length > 0,
      indexes,
      dupRequestTypeGroups: dupRequestType,
      dupSystemAccrualGroups: dupSystemAccrual,
    },
    null,
    2
  )
);

await client.end();
