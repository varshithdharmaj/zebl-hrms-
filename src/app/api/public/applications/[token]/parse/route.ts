import { NextResponse } from "next/server";
import { parseSubmissionResume } from "@/lib/recruitment/public-apply/public-application-service";
import { extractTokenFromParam, guardPublicApplyRequest, toPublicErrorResponse } from "@/lib/recruitment/public-apply/http-helpers";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const guard = guardPublicApplyRequest(request, "parse");
  if (guard) return guard;

  try {
    const { token: rawToken } = await params;
    const token = extractTokenFromParam(rawToken);

    const outcome = await parseSubmissionResume(token);
    // 200 even on parse_failed — the candidate must be able to continue
    // manually, this is not an error state for the HTTP layer.
    return NextResponse.json({ ...outcome, canContinueManually: true });
  } catch (err) {
    return toPublicErrorResponse(err);
  }
}
