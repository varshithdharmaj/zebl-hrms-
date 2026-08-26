import { NextResponse } from "next/server";
import { AUDIT_ACTIONS, writeAuditLog } from "@/lib/audit";
import { consumeApprovalToken } from "@/lib/approval-tokens/token-consumer";
import { verifyTeamsCallbackSignature } from "@/lib/microsoft/graph-teams";
import { getClientIp, getUserAgent } from "@/lib/request-meta";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const clientIp = getClientIp(request.headers);
  const limit = checkRateLimit(`teams-callback:${clientIp ?? "unknown"}`, 30, 10 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  const timestamp = request.headers.get("x-zebl-timestamp") ?? "";
  const signature = request.headers.get("x-zebl-signature") ?? "";
  const rawBody = await request.text();

  if (!verifyTeamsCallbackSignature(rawBody, timestamp, signature)) {
    await writeAuditLog({
      entityType: "teams",
      entityId: "callback",
      action: AUDIT_ACTIONS.TEAMS_NOTIFICATION_FAILED,
      metadata: { reason: "invalid_signature", clientIp },
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: { signedToken?: string; comment?: string };
  try {
    body = JSON.parse(rawBody) as { signedToken?: string; comment?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.signedToken) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const result = await consumeApprovalToken({
    signedToken: body.signedToken,
    comment: body.comment,
    clientIp,
    userAgent: getUserAgent(request.headers),
  });

  if (!result.success) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  await writeAuditLog({
    entityType: "teams",
    entityId: "callback",
    action: AUDIT_ACTIONS.TEAMS_APPROVAL_EXECUTED,
    metadata: { clientIp, workflowStatus: result.workflowStatus },
  });

  return NextResponse.json({
    type: "application/vnd.microsoft.card.adaptive",
    version: "1.4",
    body: [
      {
        type: "TextBlock",
        text: result.message,
        wrap: true,
      },
    ],
  });
}
