import { logger } from "@/lib/observability/logger";

/**
 * Timing logs are off by default in production.
 * Enable with ZEBL_PERF_TIMING=1 (or leave unset in development).
 * Set ZEBL_PERF_TIMING=0 to silence even in development.
 */
function shouldLogTiming(): boolean {
  const flag = process.env.ZEBL_PERF_TIMING;
  if (flag === "0" || flag === "false") return false;
  if (flag === "1" || flag === "true") return true;
  return process.env.NODE_ENV === "development";
}

/**
 * Measure async work for production performance baselines.
 * Logs durationMs under a stable operation name (no PII).
 */
export async function withTiming<T>(
  operation: string,
  fn: () => Promise<T>,
  meta?: Record<string, string | number | boolean | undefined>
): Promise<T> {
  if (!shouldLogTiming()) {
    return fn();
  }

  const started = performance.now();
  try {
    return await fn();
  } finally {
    const durationMs = Math.round(performance.now() - started);
    logger.info("timing", {
      operation,
      durationMs,
      ...meta,
    });
  }
}
