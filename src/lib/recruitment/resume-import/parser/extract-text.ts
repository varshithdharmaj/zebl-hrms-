import "server-only";

import { extractText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";
import type { ResumeParserError, ResumeTextExtraction } from "./types";

const PDF_MIME = new Set([
  "application/pdf",
  "application/x-pdf",
]);

const DOCX_MIME = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/docx",
]);

function extensionOf(fileName: string): string {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? (parts.at(-1) ?? "") : "";
}

export function detectResumeDocumentKind(
  fileName: string,
  mimeType: string
): "pdf" | "docx" | "unsupported" {
  const ext = extensionOf(fileName);
  const mime = (mimeType || "").toLowerCase().trim();

  if (ext === "pdf" || PDF_MIME.has(mime)) return "pdf";
  if (ext === "docx" || DOCX_MIME.has(mime)) return "docx";
  // Legacy .doc is not supported in V1 (binary OLE — needs different tooling).
  return "unsupported";
}

function toUint8Array(buffer: Buffer | Uint8Array): Uint8Array {
  const copy = new Uint8Array(buffer.byteLength);
  copy.set(buffer);
  return copy;
}

async function extractPdfText(bytes: Uint8Array): Promise<{ text: string; pageCount: number }> {
  const proxy = await getDocumentProxy(toUint8Array(bytes));
  const { totalPages, text } = await extractText(proxy, { mergePages: true });
  const merged = Array.isArray(text) ? text.join("\n") : String(text ?? "");
  return { text: merged, pageCount: totalPages };
}

async function extractDocxText(bytes: Buffer | Uint8Array): Promise<string> {
  const result = await mammoth.extractRawText({
    buffer: Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes),
  });
  return result.value ?? "";
}

export type ExtractResumeTextResult =
  | { ok: true; extraction: ResumeTextExtraction }
  | { ok: false; error: ResumeParserError };

/**
 * Extract plain text from a resume file buffer.
 * Scanned/image-only PDFs yield empty text (OCR out of scope).
 */
export async function extractResumeText(input: {
  content: Buffer | Uint8Array;
  fileName: string;
  mimeType: string;
}): Promise<ExtractResumeTextResult> {
  const kind = detectResumeDocumentKind(input.fileName, input.mimeType);
  if (kind === "unsupported") {
    return {
      ok: false,
      error: {
        code: "UNSUPPORTED_TYPE",
        message: "Only PDF and DOCX resumes are supported.",
        details: `${input.fileName} (${input.mimeType || "unknown"})`,
      },
    };
  }

  if (!input.content || input.content.byteLength === 0) {
    return {
      ok: false,
      error: {
        code: "EMPTY_DOCUMENT",
        message: "The uploaded file is empty.",
      },
    };
  }

  try {
    if (kind === "pdf") {
      const { text, pageCount } = await extractPdfText(toUint8Array(input.content));
      return {
        ok: true,
        extraction: {
          text,
          mimeType: input.mimeType || "application/pdf",
          fileName: input.fileName,
          pageCount,
        },
      };
    }

    const text = await extractDocxText(input.content);
    return {
      ok: true,
      extraction: {
        text,
        mimeType:
          input.mimeType ||
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileName: input.fileName,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: {
        code: "CORRUPTED_FILE",
        message: "Could not read the resume file. It may be corrupted or password-protected.",
        details: err instanceof Error ? err.message : String(err),
      },
    };
  }
}
