import { NextResponse } from "next/server";
import { consumeApprovalToken } from "@/lib/approval-tokens/token-consumer";
import { getClientIp, getUserAgent } from "@/lib/request-meta";
import { checkRateLimit } from "@/lib/rate-limit";
import { AUDIT_ACTIONS, writeAuditLog } from "@/lib/audit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const clientIp = getClientIp(request.headers) ?? "unknown";
  const userAgent = getUserAgent(request.headers);

  const rateCheck = checkRateLimit(`approve-token:${clientIp}`, 5, 60 * 1000);
  if (!rateCheck.allowed) {
    await writeAuditLog({
      entityType: "approval_token",
      entityId: "rate_limit",
      action: AUDIT_ACTIONS.LEAVE_REJECTED,
      metadata: { reason: "rate_limited", clientIp, userAgent },
    });
    return NextResponse.json(
      { error: "Too many attempts. Please try again in a minute." },
      {
        status: 429,
        headers: {
          "Retry-After": Math.ceil(rateCheck.retryAfterMs / 1000).toString(),
        },
      }
    );
  }

  const { token } = await params;
  const signedToken = decodeURIComponent(token);
  const body = (await request.json().catch(() => ({}))) as { comment?: string };

  const result = await consumeApprovalToken({
    signedToken,
    comment: body.comment,
    clientIp,
    userAgent,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    message: result.message,
    workflowStatus: result.workflowStatus,
  });
}
