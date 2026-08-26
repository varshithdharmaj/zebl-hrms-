/**
 * Public base URL for links, OAuth callbacks, and emails.
 * Vercel sets VERCEL_URL automatically (no custom domain required).
 */
export function getAppBaseUrl(): string {
  const explicit = process.env.APP_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;

  return "http://localhost:3000";
}

export function hasExplicitAppBaseUrl(): boolean {
  return Boolean(process.env.APP_BASE_URL?.trim()) || Boolean(process.env.VERCEL_URL?.trim());
}
