import { NextResponse } from "next/server";
import { getReview, updateReview } from "@/lib/recruitment/public-apply/public-application-service";
import { extractTokenFromParam, guardPublicApplyRequest, toPublicErrorResponse } from "@/lib/recruitment/public-apply/http-helpers";
import { publicReviewPayloadSchema } from "@/lib/validation/schemas/recruitment/public-apply";
import { PublicApplyError } from "@/lib/recruitment/public-apply/types";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const guard = guardPublicApplyRequest(request, "review");
  if (guard) return guard;

  try {
    const { token: rawToken } = await params;
    const token = extractTokenFromParam(rawToken);
    const result = await getReview(token);
    return NextResponse.json(result);
  } catch (err) {
    return toPublicErrorResponse(err);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const guard = guardPublicApplyRequest(request, "review");
  if (guard) return guard;

  try {
    const { token: rawToken } = await params;
    const token = extractTokenFromParam(rawToken);

    const body = await request.json().catch(() => null);
    const parsed = publicReviewPayloadSchema.safeParse(body);
    if (!parsed.success) {
      throw new PublicApplyError(
        "VALIDATION_FAILED",
        parsed.error.issues[0]?.message ?? "Please check the highlighted fields."
      );
    }

    await updateReview(token, parsed.data);
    return NextResponse.json({ status: "candidate_edited" });
  } catch (err) {
    return toPublicErrorResponse(err);
  }
}
