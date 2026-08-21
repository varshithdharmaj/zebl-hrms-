import "server-only";

import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { logger } from "@/lib/observability/logger";
import { isAllowedOrigin } from "@/lib/recruitment/public-apply/origin-guard";
import { PublicApplyError } from "@/lib/recruitment/public-apply/types";
import { checkPublicApplyRateLimit } from "@/lib/recruitment/public-apply/public-application-service";

/** Truncated, salted-by-secret hash — never store/log a raw client IP (§14/§15). */
export function hashClientIp(request: Request): string | null {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null;
  if (!ip) return null;
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

export function toPublicErrorResponse(err: unknown): NextResponse {
  if (err instanceof PublicApplyError) {
    return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.status });
  }
  logger.error("recruitment.public_apply.unhandled_error", {
    entityType: "public_application_submission",
    reason: err instanceof Error ? err.message : "unknown",
  });
  return NextResponse.json(
    {
      error: {
        code: "TEMPORARY_FAILURE",
        message: "Something went wrong on our end. Please try again in a moment.",
      },
    },
    { status: 500 }
  );
}

/** Origin check + rate limit — shared guard for every state-changing public route. */
export function guardPublicApplyRequest(
  request: Request,
  scope: Parameters<typeof checkPublicApplyRateLimit>[0]
): NextResponse | null {
  if (!isAllowedOrigin(request.headers.get("origin"))) {
    return NextResponse.json(
      { error: { code: "ORIGIN_INVALID", message: "Request origin not allowed." } },
      { status: 403 }
    );
  }

  const ipHash = hashClientIp(request) ?? "unknown";
  const limit = checkPublicApplyRateLimit(scope, ipHash);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many attempts. Please try again shortly." } },
      { status: 429 }
    );
  }

  return null;
}

export function extractTokenFromParam(token: string | undefined): string {
  if (!token) {
    throw new PublicApplyError("SESSION_INVALID", "Your session isn't valid. Please start your application again.");
  }
  return decodeURIComponent(token);
}
