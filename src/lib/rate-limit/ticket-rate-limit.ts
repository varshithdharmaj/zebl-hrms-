import { prisma } from "@/lib/prisma";

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const MAX_TICKETS_PER_WINDOW = 5;

// In-memory rate limit store (use Redis in production)
const ticketCreationLimits = new Map<number, { count: number; resetAt: number }>();

/**
 * Check if an employee can create a ticket based on rate limits.
 * Returns true if allowed, false if rate limit exceeded.
 */
export function checkTicketCreationRateLimit(employeeId: number): boolean {
  const now = Date.now();
  const limit = ticketCreationLimits.get(employeeId);

  if (!limit || now > limit.resetAt) {
    // No limit or expired, reset
    ticketCreationLimits.set(employeeId, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return true;
  }

  if (limit.count >= MAX_TICKETS_PER_WINDOW) {
    return false;
  }

  limit.count++;
  return true;
}

/**
 * Get remaining time until rate limit resets (in seconds).
 */
export function getRateLimitResetTime(employeeId: number): number {
  const limit = ticketCreationLimits.get(employeeId);
  if (!limit) return 0;

  const remaining = Math.max(0, Math.ceil((limit.resetAt - Date.now()) / 1000));
  return remaining;
}

/**
 * Clean up expired rate limit entries (should be called periodically).
 */
export function cleanupExpiredRateLimits(): void {
  const now = Date.now();
  for (const [employeeId, limit] of ticketCreationLimits.entries()) {
    if (now > limit.resetAt) {
      ticketCreationLimits.delete(employeeId);
    }
  }
}

// Cleanup every 5 minutes
setInterval(cleanupExpiredRateLimits, 5 * 60 * 1000);
