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

export function requireServerSecret(key: string): string {
  if (typeof window !== "undefined") {
    throw new Error(`Security violation: Server secret '${key}' cannot be accessed on the client.`);
  }
  const value = getEnv(key);
  if (!value) {
    throw new Error(`Missing required server secret environment variable: ${key}`);
  }
  return value;
}

export function sanitizeSecretForLog(secret: string): string {
  if (!secret) return "[empty]";
  if (secret.length <= 6) return "*****";
  return `${secret.slice(0, 2)}***${secret.slice(-2)}`;
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function isPostgresDatabase(): boolean {
  const url = getEnv("DATABASE_URL") ?? "";
  return url.startsWith("postgresql://") || url.startsWith("postgres://");
}
