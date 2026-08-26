import { NextResponse } from "next/server";
import { AppError, toClientError } from "@/lib/errors/app-error";
import { createCorrelationId } from "@/lib/observability/correlation";

export function apiErrorResponse(error: unknown, correlationId?: string): NextResponse {
  const cid = correlationId ?? createCorrelationId();
  const body = toClientError(error, cid);
  const status = error instanceof AppError ? error.statusCode : 500;
  return NextResponse.json(body, { status, headers: { "x-correlation-id": cid } });
}

export function parseApiError(payload: unknown): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    return String((payload as { error: unknown }).error);
  }
  return "Request failed.";
}
