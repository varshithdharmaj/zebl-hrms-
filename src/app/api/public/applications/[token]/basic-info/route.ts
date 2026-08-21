import { NextResponse } from "next/server";
import { saveBasicInfo } from "@/lib/recruitment/public-apply/public-application-service";
import { extractTokenFromParam, guardPublicApplyRequest, toPublicErrorResponse } from "@/lib/recruitment/public-apply/http-helpers";
import { publicBasicInfoSchema } from "@/lib/validation/schemas/recruitment/public-apply";
import { PublicApplyError } from "@/lib/recruitment/public-apply/types";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const guard = guardPublicApplyRequest(request, "basic-info");
  if (guard) return guard;

  try {
    const { token: rawToken } = await params;
    const token = extractTokenFromParam(rawToken);

    const body = await request.json().catch(() => null);
    const parsed = publicBasicInfoSchema.safeParse(body);
    if (!parsed.success) {
      throw new PublicApplyError(
        "VALIDATION_FAILED",
        parsed.error.issues[0]?.message ?? "Please check the highlighted fields."
      );
    }

    await saveBasicInfo(token, parsed.data);
    return NextResponse.json({ status: "basic_info_complete" });
  } catch (err) {
    return toPublicErrorResponse(err);
  }
}
