export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "WORKFLOW"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTEGRATION"
  | "INTERNAL";

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly correlationId?: string;
  readonly expose: boolean;

  constructor(params: {
    code: ErrorCode;
    message: string;
    statusCode?: number;
    correlationId?: string;
    expose?: boolean;
    cause?: unknown;
  }) {
    super(params.message, { cause: params.cause });
    this.name = "AppError";
    this.code = params.code;
    this.statusCode = params.statusCode ?? statusForCode(params.code);
    this.correlationId = params.correlationId;
    this.expose = params.expose ?? params.code !== "INTERNAL";
  }
}

function statusForCode(code: ErrorCode): number {
  switch (code) {
    case "UNAUTHORIZED":
      return 401;
    case "FORBIDDEN":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "VALIDATION":
    case "WORKFLOW":
      return 400;
    case "CONFLICT":
      return 409;
    case "RATE_LIMITED":
      return 429;
    case "INTEGRATION":
      return 502;
    default:
      return 500;
  }
}

export function toClientError(error: unknown, correlationId?: string): {
  error: string;
  code?: string;
  correlationId?: string;
} {
  if (error instanceof AppError && error.expose) {
    return {
      error: error.message,
      code: error.code,
      correlationId: error.correlationId ?? correlationId,
    };
  }
  return {
    error: "An unexpected error occurred.",
    correlationId,
  };
}
