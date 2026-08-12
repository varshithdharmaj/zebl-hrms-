import "dotenv/config";
import pg from "pg";

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

const sample = await client.query(`
  SELECT employee_id, reason, COUNT(*)::int AS c
  FROM leave_transactions
  WHERE transaction_type = 'accrual'
    AND leave_request_id IS NULL
    AND reason IS NOT NULL
  GROUP BY 1, 2
  HAVING COUNT(*) > 1
  ORDER BY c DESC
  LIMIT 10
`);

const totals = await client.query(`
  SELECT
    COUNT(DISTINCT employee_id)::int AS employees_with_dups,
    COALESCE(SUM(c - 1), 0)::int AS extra_rows
  FROM (
    SELECT employee_id, reason, COUNT(*)::int AS c
    FROM leave_transactions
    WHERE transaction_type = 'accrual'
      AND leave_request_id IS NULL
      AND reason IS NOT NULL
    GROUP BY 1, 2
    HAVING COUNT(*) > 1
  ) d
`);

console.log(
  JSON.stringify(
    {
      employeesWithDups: totals.rows[0].employees_with_dups,
      extraRowsBeyondOne: totals.rows[0].extra_rows,
      sample: sample.rows,
    },
    null,
    2
  )
);
await client.end();
