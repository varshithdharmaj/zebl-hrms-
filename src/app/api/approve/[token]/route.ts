import { NextResponse } from "next/server";
import { consumeApprovalToken } from "@/lib/approval-tokens/token-consumer";
import { getClientIp, getUserAgent } from "@/lib/request-meta";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const signedToken = decodeURIComponent(token);
  const body = (await request.json().catch(() => ({}))) as { comment?: string };

  const result = await consumeApprovalToken({
    signedToken,
    comment: body.comment,
    clientIp: getClientIp(request.headers),
    userAgent: getUserAgent(request.headers),
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
