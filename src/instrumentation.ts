export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Vercel's Node.js functions default to UTC, unlike local dev (which inherits the
    // machine's IST timezone). All attendance/date logic in this app (startOfDay,
    // isSameDay, toISODate, etc.) intentionally uses local-timezone Date methods, so the
    // server's local timezone must be IST for those calculations to match local dev.
    // `TZ` itself is a reserved env var name on Vercel's dashboard, so it's set here
    // instead, before any Date is constructed.
    process.env.TZ = "Asia/Kolkata";

    const { validateApplicationConfig } = await import("@/lib/config/validate");
    const { validateAuthEnvironment } = await import("@/lib/auth/auth-config");
    const { validateDatabaseUrl, probeDatabaseConnection } = await import(
      "@/lib/config/database"
    );

    const dbUrl = validateDatabaseUrl();
    if (!dbUrl.ok) {
      const msg = `[zebl] ${dbUrl.message}${dbUrl.hint ? ` ${dbUrl.hint}` : ""}`;
      console.error(msg);
      throw new Error(msg);
    }

    const config = validateApplicationConfig({
      strict: process.env.NODE_ENV === "production",
    });
    const authIssues = validateAuthEnvironment({
      strict: process.env.NODE_ENV === "production",
    });

    const all = [
      ...config.issues.map((i) => `[config] ${i.field}: ${i.message}`),
      ...authIssues.map((i) => `[auth] ${i.field}: ${i.message}`),
    ];

    if (all.length > 0) {
      const fn = config.ok ? console.warn : console.error;
      fn("[zebl] Startup configuration issues:", all.join("; "));
      // Do not throw in production: instrumentation failures become 500 HTML for every
      // dynamic request (health, login Server Actions) → client "unexpected response".
      // AUTH_SECRET / DATABASE_URL errors still fail at the first request that needs them.
      if (!config.ok && process.env.NODE_ENV !== "production") {
        throw new Error("Application configuration validation failed at startup.");
      }
      if (!config.ok && process.env.NODE_ENV === "production") {
        console.error(
          "[zebl] Continuing despite config errors so health/logs remain reachable. Fix env and redeploy."
        );
      }
    }

    // probeDatabaseConnection is skipped in Cloudflare Workers deployments
    // via ZEBL_SKIP_DB_STARTUP=true set in wrangler.jsonc. The pg adapter
    // handles DB connectivity on actual requests without a startup TCP probe.
    const dbProbe = await probeDatabaseConnection();
    if (!dbProbe.ok) {
      console.error(`[zebl] ${dbProbe.message}`);
      if (dbProbe.hint) console.error(dbProbe.hint);
      const skip = process.env.ZEBL_SKIP_DB_STARTUP?.trim() === "true";
      const isDev = process.env.NODE_ENV !== "production";
      // Fail fast in local/dev so misconfigured DBs are obvious. In production, do not
      // throw here — a hard instrumentation failure turns every request into a 500
      // (including Server Actions → "unexpected response was received from the server").
      if (!skip && isDev) {
        throw new Error(
          `${dbProbe.message ?? "Database connection failed."} Set ZEBL_SKIP_DB_STARTUP=true to bypass (not recommended).`
        );
      }
    }
  }
}
