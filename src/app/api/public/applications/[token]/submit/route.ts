import { NextResponse } from "next/server";
import { submitPublicApplication } from "@/lib/recruitment/public-apply/public-application-service";
import { extractTokenFromParam, guardPublicApplyRequest, toPublicErrorResponse } from "@/lib/recruitment/public-apply/http-helpers";
import { publicSubmitSchema } from "@/lib/validation/schemas/recruitment/public-apply";
import { PublicApplyError } from "@/lib/recruitment/public-apply/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const guard = guardPublicApplyRequest(request, "submit");
  if (guard) return guard;

  try {
    const { token: rawToken } = await params;
    const token = extractTokenFromParam(rawToken);

    const body = await request.json().catch(() => null);
    const parsed = publicSubmitSchema.safeParse(body);
    if (!parsed.success) {
      throw new PublicApplyError(
        "VALIDATION_FAILED",
        parsed.error.issues[0]?.message ?? "Please acknowledge the privacy notice to submit."
      );
    }

    const result = await submitPublicApplication(token);
    return NextResponse.json({ status: "submitted", referenceCode: result.referenceCode });
  } catch (err) {
    return toPublicErrorResponse(err);
  }
}
