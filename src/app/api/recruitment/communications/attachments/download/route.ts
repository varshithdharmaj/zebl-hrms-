import { NextResponse } from "next/server";
import { getSessionOrThrow } from "@/lib/auth-guards";
import { isRecruitmentModuleEnabled } from "@/lib/recruitment/config/feature-flags";
import { createCommunicationService } from "@/lib/recruitment/services/communication-service";
import { isRecruitmentDomainError } from "@/lib/recruitment/shared/errors";

export async function GET(request: Request) {
  try {
    const session = await getSessionOrThrow();
    if (!isRecruitmentModuleEnabled()) {
      return new NextResponse("Recruitment module is disabled.", { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return new NextResponse("Missing attachment id.", { status: 400 });
    }

    const service = createCommunicationService();
    const { content, fileName, fileType } = await service.getAttachmentContent(session, id);

    return new NextResponse(new Uint8Array(content), {
      headers: {
        "Content-Type": fileType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (isRecruitmentDomainError(error)) {
      const status =
        error.code === "REC_NOT_FOUND"
          ? 404
          : error.code === "REC_UNAUTHORIZED" || error.code === "REC_FORBIDDEN_SCOPE"
            ? 403
            : 400;
      return new NextResponse(error.message, { status });
    }
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
