/**
 * Sequential authenticated smoke — not a load test.
 * Usage: BASE_URL=... ZEBL_SESSION_COOKIE='zebl_session=...' node scripts/load-test/authenticated-smoke.mjs
 */
const base = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const cookie = process.env.ZEBL_SESSION_COOKIE;
if (!cookie) {
  console.error("Set ZEBL_SESSION_COOKIE to a logged-in zebl_session cookie.");
  process.exit(1);
}

const paths = [
  "/admin/dashboard",
  "/admin/recruitment/candidates",
  "/login",
];

for (const path of paths) {
  const started = performance.now();
  const res = await fetch(`${base}${path}`, {
    headers: { cookie },
    redirect: "manual",
  });
  const ms = Math.round(performance.now() - started);
  console.log(`${res.status} ${path} ttfb_approx=${ms}ms`);
}
