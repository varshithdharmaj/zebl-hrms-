import { NextResponse } from "next/server";
import { startPublicSubmission } from "@/lib/recruitment/public-apply/public-application-service";
import { guardPublicApplyRequest, hashClientIp, toPublicErrorResponse } from "@/lib/recruitment/public-apply/http-helpers";
import { startPublicSubmissionSchema } from "@/lib/validation/schemas/recruitment/public-apply";
import { PublicApplyError } from "@/lib/recruitment/public-apply/types";

export async function POST(request: Request) {
  const guard = guardPublicApplyRequest(request, "start");
  if (guard) return guard;

  const body = await request.json().catch(() => null);
  const parsed = startPublicSubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return toPublicErrorResponse(
      new PublicApplyError("VALIDATION_FAILED", "A job must be selected to start an application.")
    );
  }

  try {
    const result = await startPublicSubmission({
      jobPublicSlug: parsed.data.jobPublicSlug,
      ipHash: hashClientIp(request),
      website: parsed.data.website,
      formRenderedAt: parsed.data.formRenderedAt,
    });
    return NextResponse.json(result);
  } catch (err) {
    return toPublicErrorResponse(err);
  }
}
