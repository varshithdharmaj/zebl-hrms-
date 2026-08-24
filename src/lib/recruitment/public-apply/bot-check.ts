/**
 * Lightweight bot protection for /start (Phase-3 hardening §5) — honeypot +
 * minimum-elapsed-time. Deliberately no dependencies (no DB, no env) so it's
 * cheap to unit test and easy to reason about in isolation.
 */

/** Bots that fill every field tend to submit within this window; real
 * candidates take at least a couple of seconds to notice the form and click
 * through. Deliberately short — never punish a fast human. */
export const MIN_FORM_ELAPSED_MS = 1200;

export type BotCheckResult = { blocked: true; reason: "honeypot" | "timing" } | { blocked: false };

export function checkForBot(input: { website?: string; formRenderedAt?: number }): BotCheckResult {
  if (input.website && input.website.trim().length > 0) {
    return { blocked: true, reason: "honeypot" };
  }

  if (typeof input.formRenderedAt === "number") {
    const elapsed = Date.now() - input.formRenderedAt;
    // A negative elapsed time (client clock ahead of server) is ambiguous
    // clock skew, not a bot signal — only flag a suspiciously fast, non-
    // negative elapsed time.
    if (elapsed >= 0 && elapsed < MIN_FORM_ELAPSED_MS) {
      return { blocked: true, reason: "timing" };
    }
  }

  return { blocked: false };
}
