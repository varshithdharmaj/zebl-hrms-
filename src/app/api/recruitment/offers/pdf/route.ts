import { NextResponse } from "next/server";
import { requireHROrSuperAdminSession } from "@/lib/auth-guards";
import { isRecruitmentModuleEnabled } from "@/lib/recruitment/config/feature-flags";
import { createOfferService } from "@/lib/recruitment/services/offer-service";
import { sanitizeDownloadFileName } from "@/lib/recruitment/shared/storage-paths";
import { RecruitmentDomainError } from "@/lib/recruitment/shared/errors";

export async function GET(request: Request) {
  try {
    const session = await requireHROrSuperAdminSession();

    if (!isRecruitmentModuleEnabled()) {
      return new NextResponse("Recruitment module is disabled.", { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return new NextResponse("Missing offer id.", { status: 400 });
    }

    const service = createOfferService();
    const { content, fileName, mimeType } = await service.getOfferPdfContent(session, id);
    const downloadName = sanitizeDownloadFileName(
      searchParams.get("name") || fileName || "offer.pdf"
    );

    return new NextResponse(new Uint8Array(content), {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(downloadName)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof RecruitmentDomainError) {
      const status =
        error.code === "REC_NOT_FOUND"
          ? 404
          : error.code === "REC_FORBIDDEN_SCOPE"
            ? 403
            : 400;
      return new NextResponse(error.message, { status });
    }
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
