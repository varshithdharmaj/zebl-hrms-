import { NextResponse } from "next/server";
import { PHOTO_UPLOAD_MAX_BYTES, uploadPhoto } from "@/lib/recruitment/public-apply/public-application-service";
import { extractTokenFromParam, guardPublicApplyRequest, toPublicErrorResponse } from "@/lib/recruitment/public-apply/http-helpers";
import { PublicApplyError } from "@/lib/recruitment/public-apply/types";

// Route handler (not a Server Action) for the same reason as the resume
// route — avoids raising next.config.ts's serverActions.bodySizeLimit
// globally for a per-endpoint file cap.
export const runtime = "nodejs";

const CONTENT_LENGTH_GUARD_BYTES = PHOTO_UPLOAD_MAX_BYTES + 1024 * 1024;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const guard = guardPublicApplyRequest(request, "photo");
  if (guard) return guard;

  try {
    const { token: rawToken } = await params;
    const token = extractTokenFromParam(rawToken);

    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > 0 && contentLength > CONTENT_LENGTH_GUARD_BYTES) {
      throw new PublicApplyError("RESUME_TOO_LARGE", "Photo is too large. Maximum size is 5 MB.");
    }

    const form = await request.formData();
    const file = form.get("photo");
    if (!(file instanceof File)) {
      throw new PublicApplyError("RESUME_INVALID", "Please select a photo.");
    }
    if (file.size > CONTENT_LENGTH_GUARD_BYTES) {
      throw new PublicApplyError("RESUME_TOO_LARGE", "Photo is too large. Maximum size is 5 MB.");
    }

    const content = Buffer.from(await file.arrayBuffer());
    await uploadPhoto(token, {
      fileName: file.name || "photo",
      mimeType: file.type || "application/octet-stream",
      content,
    });

    return NextResponse.json({ status: "photo_uploaded" });
  } catch (err) {
    return toPublicErrorResponse(err);
  }
}
