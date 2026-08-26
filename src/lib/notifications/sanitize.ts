/** Strip control chars and limit length for safe email template interpolation */
export function sanitizeText(value: string, maxLength = 2000): string {
  return value
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/<[^>]*>/g, "")
    .trim()
    .slice(0, maxLength);
}

export function sanitizeEmail(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
  return trimmed;
}
