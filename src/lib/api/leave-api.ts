import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { AppError } from "@/lib/errors/app-error";
import { apiErrorResponse } from "@/lib/errors/api-response";
import { toAppError } from "@/lib/errors/map-error";
import { createCorrelationId } from "@/lib/observability/correlation";

export async function requireApiSession() {
  const session = await getSession();
  if (!session) return null;
  return session;
}

export function apiUnauthorized(correlationId?: string) {
  const cid = correlationId ?? createCorrelationId("api");
  return apiErrorResponse(
    new AppError({ code: "UNAUTHORIZED", message: "Unauthorized", correlationId: cid }),
    cid
  );
}

/** @deprecated Prefer apiErrorResponse + toAppError directly */
export function apiError(error: unknown, correlationId?: string) {
  const cid = correlationId ?? createCorrelationId("api");
  return apiErrorResponse(toAppError(error, cid), cid);
}

export function apiJsonOk<T>(data: T, correlationId?: string) {
  const cid = correlationId ?? createCorrelationId("api");
  return NextResponse.json(data, { headers: { "x-correlation-id": cid } });
}
