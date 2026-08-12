import { createCorrelationId } from "@/lib/observability/correlation";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogContext = {
  correlationId?: string;
  worker?: string;
  entityType?: string;
  entityId?: string;
  [key: string]: unknown;
};

function redactContext(context?: LogContext): LogContext | undefined {
  if (!context) return undefined;
  const out: LogContext = {};
  for (const [key, value] of Object.entries(context)) {
    if (/password|secret|token|authorization|cookie|bearer|cron/i.test(key)) {
      out[key] = "[redacted]";
    } else {
      out[key] = value;
    }
  }
  return out;
}

function emit(level: LogLevel, message: string, context?: LogContext): void {
  const safe = redactContext(context);
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    correlationId: safe?.correlationId ?? createCorrelationId("log"),
    ...safe,
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, context?: LogContext) => emit("debug", message, context),
  info: (message: string, context?: LogContext) => emit("info", message, context),
  warn: (message: string, context?: LogContext) => emit("warn", message, context),
  error: (message: string, context?: LogContext) => emit("error", message, context),
};
