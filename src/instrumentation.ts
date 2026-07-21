export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
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
      if (!config.ok && process.env.NODE_ENV === "production") {
        throw new Error("Application configuration validation failed at startup.");
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
      if (!skip && isDev) {
        throw new Error(
          `${dbProbe.message ?? "Database connection failed."} Set ZEBL_SKIP_DB_STARTUP=true to bypass (not recommended).`
        );
      }
      if (!skip && process.env.NODE_ENV === "production") {
        throw new Error(dbProbe.message ?? "Database connection failed.");
      }
    }
  }
}
