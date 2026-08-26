import { AppError } from "@/lib/errors/app-error";
import { PermissionError } from "@/lib/permissions";
import { WorkflowError } from "@/lib/workflow/leave-workflow";

/** Maps domain errors to AppError for consistent API responses */
export function toAppError(error: unknown, correlationId?: string): AppError | unknown {
  if (error instanceof AppError) {
    if (correlationId && !error.correlationId) {
      return new AppError({
        code: error.code,
        message: error.message,
        statusCode: error.statusCode,
        correlationId,
        expose: error.expose,
        cause: error.cause,
      });
    }
    return error;
  }
  if (error instanceof WorkflowError) {
    return new AppError({
      code: "WORKFLOW",
      message: error.message,
      correlationId,
    });
  }
  if (error instanceof PermissionError) {
    return new AppError({
      code: "FORBIDDEN",
      message: error.message,
      correlationId,
    });
  }
  if (error instanceof Error && error.message.toLowerCase().includes("unauthorized")) {
    return new AppError({
      code: "UNAUTHORIZED",
      message: error.message,
      correlationId,
    });
  }
  return error;
}
