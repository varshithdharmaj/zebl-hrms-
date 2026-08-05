export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  return email.trim().toLowerCase().replace(/\s+/g, "");
}

export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  return phone.replace(/[\s\-()]/g, "").replace(/^\+/, "").replace(/\D/g, "");
}
