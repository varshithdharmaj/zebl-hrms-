export function getClientIp(headers: Headers): string | undefined {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim();
  return headers.get("x-real-ip") ?? undefined;
}

export function getUserAgent(headers: Headers): string | undefined {
  return headers.get("user-agent") ?? undefined;
}
