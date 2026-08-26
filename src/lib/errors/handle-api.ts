import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { AppError } from "@/lib/errors/app-error";
import { apiErrorResponse } from "@/lib/errors/api-response";
import { toAppError } from "@/lib/errors/map-error";
import { createCorrelationId } from "@/lib/observability/correlation";
import { logger } from "@/lib/observability/logger";

export type ApiHandlerContext = {
  correlationId: string;
  session: NonNullable<Awaited<ReturnType<typeof getSession>>>;
};

type ApiHandler = (
  request: Request,
  ctx: ApiHandlerContext
) => Promise<NextResponse>;

/**
 * Wraps route handlers with session check, correlation IDs, and standardized errors.
 */
export function withAuthenticatedApi(handler: ApiHandler) {
  return async (request: Request): Promise<NextResponse> => {
    const correlationId = createCorrelationId("api");
    try {
      const session = await getSession();
      if (!session) {
        return apiErrorResponse(
          new AppError({
            code: "UNAUTHORIZED",
            message: "Unauthorized",
            correlationId,
          }),
          correlationId
        );
      }
      return await handler(request, { correlationId, session });
    } catch (error) {
      logger.error("api_handler_error", {
        correlationId,
        path: new URL(request.url).pathname,
        error: error instanceof Error ? error.message : String(error),
      });
      return apiErrorResponse(toAppError(error, correlationId), correlationId);
    }
  };
}

export function jsonOk<T>(data: T, correlationId: string, status = 200): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: { "x-correlation-id": correlationId },
  });
}
