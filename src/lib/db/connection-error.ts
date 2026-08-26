/** User- and developer-friendly database connection diagnostics */

export function parsePostgresHost(url: string): { host: string; port: number; database: string } {
  try {
    const parsed = new URL(url.replace(/^postgres:\/\//, "postgresql://"));
    return {
      host: parsed.hostname || "localhost",
      port: parsed.port ? parseInt(parsed.port, 10) : 5432,
      database: parsed.pathname.replace(/^\//, "") || "postgres",
    };
  } catch {
    return { host: "localhost", port: 5432, database: "unknown" };
  }
}

export function isDbUnreachableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  const name = error.constructor.name;
  return (
    name === "PrismaClientInitializationError" ||
    msg.includes("can't reach database server") ||
    msg.includes("connection refused") ||
    msg.includes("econnrefused") ||
    msg.includes("p1001")
  );
}

export function formatDbConnectionHelp(databaseUrl?: string): string {
  const url = databaseUrl ?? process.env.DATABASE_URL ?? "";
  const { host, port, database } = parsePostgresHost(url);

  const lines = [
    `PostgreSQL is not reachable at ${host}:${port} (database: ${database}).`,
    "",
    "Choose one setup path:",
    "",
    "  A) Docker (recommended local):",
    "     Install Docker Desktop, then:",
    "     npm run db:postgres:up",
    "     npm run db:setup",
    "",
    "  B) Hosted (no local install):",
    "     Create a free DB at https://neon.tech or https://supabase.com",
    "     Paste the postgresql:// URL into .env as DATABASE_URL",
    "     npm run db:setup",
    "",
    "  C) Windows PostgreSQL service:",
    "     See docs/POSTGRES_WINDOWS_SETUP.md",
    "",
    "Verify: npm run db:ping",
  ];
  return lines.join("\n");
}
