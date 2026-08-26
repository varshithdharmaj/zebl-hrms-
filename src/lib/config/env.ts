export function getEnv(key: string): string | undefined {
  const value = process.env[key];
  if (value === undefined || value.trim() === "") return undefined;
  return value.trim();
}

export function requireEnv(key: string): string {
  const value = getEnv(key);
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function isPostgresDatabase(): boolean {
  const url = getEnv("DATABASE_URL") ?? "";
  return url.startsWith("postgresql://") || url.startsWith("postgres://");
}
