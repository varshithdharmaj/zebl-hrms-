import { NextResponse } from "next/server";
import { getSessionOrThrow } from "@/lib/auth-guards";
import { isRecruitmentModuleEnabled } from "@/lib/recruitment/config/feature-flags";
import { createCommunicationService } from "@/lib/recruitment/services/communication-service";
import { isPreviewableAttachment } from "@/lib/recruitment/communication/attachment-rules";
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
    const { attachment } = await service.getAttachment(session, id);

    if (
      !isPreviewableAttachment({
        fileName: attachment.fileName,
        fileType: attachment.fileType,
      })
    ) {
      return new NextResponse("Preview not available for this file type.", {
        status: 415,
      });
    }

    const name = attachment.fileName.toLowerCase();
    const mime = attachment.fileType.toLowerCase();

    if (mime === "application/pdf" || name.endsWith(".pdf")) {
      const mockPdf = Buffer.from(
        "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [ 3 0 R ] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << >> /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 48 >>\nstream\nBT /F1 12 Tf 72 712 Td (Mock Communication Attachment) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000201 00000 n\ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n300\n%%EOF"
      );
      return new NextResponse(mockPdf, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": "inline",
          "Cache-Control": "private, max-age=60",
        },
      });
    }

    if (mime === "text/plain" || name.endsWith(".txt")) {
      return new NextResponse(`Preview of ${attachment.fileName}\n`, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": "inline",
          "Cache-Control": "private, max-age=60",
        },
      });
    }

    const mockPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
      "base64"
    );
    return new NextResponse(mockPng, {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": "inline",
        "Cache-Control": "private, max-age=60",
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