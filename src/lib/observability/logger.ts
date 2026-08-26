import { createCorrelationId } from "@/lib/observability/correlation";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogContext = {
  correlationId?: string;
  worker?: string;
  entityType?: string;
  entityId?: string;
  [key: string]: unknown;
};

function emit(level: LogLevel, message: string, context?: LogContext): void {
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    correlationId: context?.correlationId ?? createCorrelationId("log"),
    ...context,
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
