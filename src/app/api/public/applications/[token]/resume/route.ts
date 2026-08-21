import { NextResponse } from "next/server";
import { uploadResume } from "@/lib/recruitment/public-apply/public-application-service";
import { extractTokenFromParam, guardPublicApplyRequest, toPublicErrorResponse } from "@/lib/recruitment/public-apply/http-helpers";
import { RESUME_UPLOAD_MAX_BYTES } from "@/lib/recruitment/resume-import/file-validation";
import { PublicApplyError } from "@/lib/recruitment/public-apply/types";

// Route handler (not a Server Action) specifically so the 10 MB resume cap
// doesn't require raising next.config.ts's serverActions.bodySizeLimit for
// every Server Action in the app — see Phase-3 design correction #1.
export const runtime = "nodejs";

// A little slack over the hard cap so a just-over-limit upload gets the
// friendly RESUME_TOO_LARGE message from uploadResume() instead of a generic
// 413 — the real enforcement is still the Content-Length pre-check below.
const CONTENT_LENGTH_GUARD_BYTES = RESUME_UPLOAD_MAX_BYTES + 1024 * 1024;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const guard = guardPublicApplyRequest(request, "resume");
  if (guard) return guard;

  try {
    const { token: rawToken } = await params;
    const token = extractTokenFromParam(rawToken);

    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > 0 && contentLength > CONTENT_LENGTH_GUARD_BYTES) {
      throw new PublicApplyError("RESUME_TOO_LARGE", "File is too large. Maximum size is 10 MB.");
    }

    const form = await request.formData();
    const file = form.get("resume");
    if (!(file instanceof File)) {
      throw new PublicApplyError("RESUME_INVALID", "Please select a resume file.");
    }
    if (file.size > CONTENT_LENGTH_GUARD_BYTES) {
      throw new PublicApplyError("RESUME_TOO_LARGE", "File is too large. Maximum size is 10 MB.");
    }

    const content = Buffer.from(await file.arrayBuffer());
    await uploadResume(token, {
      fileName: file.name || "resume",
      mimeType: file.type || "application/octet-stream",
      content,
    });

    return NextResponse.json({ status: "resume_uploaded" });
  } catch (err) {
    return toPublicErrorResponse(err);
  }
}
