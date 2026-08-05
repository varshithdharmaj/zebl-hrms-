import { createHash } from "node:crypto";

/**
 * Build a stable idempotency key for event consumers / retries.
 * Does not persist — callers store keys as needed.
 */
export function buildIdempotencyKey(parts: readonly string[]): string {
  const material = parts.join("|");
  return createHash("sha256").update(material).digest("hex");
}

export function eventIdempotencyKey(
  eventType: string,
  aggregateId: string,
  causationToken: string
): string {
  return buildIdempotencyKey([eventType, aggregateId, causationToken]);
}
