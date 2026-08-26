import type { ZodError, ZodSchema } from "zod";

export function formatZodError(error: ZodError): string {
  const first = error.issues[0];
  if (!first) return "Validation failed.";
  const path = first.path.length > 0 ? `${first.path.join(".")}: ` : "";
  return `${path}${first.message}`;
}

export function parseWithSchema<T>(schema: ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

export function safeParseWithSchema<T>(
  schema: ZodSchema<T>,
  data: unknown
): { ok: true; data: T } | { ok: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, error: formatZodError(result.error) };
}
