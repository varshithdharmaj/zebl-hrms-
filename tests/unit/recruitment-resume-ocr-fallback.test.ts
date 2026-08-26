import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LlmResumeGenerator } from "@/lib/recruitment/resume-import/parser/llm-parse-resume";
import type { LlmResumeResponse } from "@/lib/recruitment/resume-import/parser/llm-parse-schema";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/observability/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/recruitment/ai/config", () => ({
  getGeminiApiKey: () => "test-fake-key",
  getGeminiModel: () => "gemini-2.5-flash",
  getAiRuntimeConfig: async () => ({
    enabled: true,
    apiKey: "test-fake-key",
    model: "gemini-2.5-flash",
    reasonDisabled: null,
  }),
}));

// Simulates a scanned/image-only PDF: unpdf/pdf.js returns an empty string,
// no error — this is the real Divya-case extraction outcome.
const extractResumeTextSpy = vi.fn(async () => ({
  ok: true as const,
  extraction: {
    text: "",
    mimeType: "application/pdf",
    fileName: "scanned-resume.pdf",
    pageCount: 1,
  },
}));

vi.mock("@/lib/recruitment/resume-import/parser/extract-text", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/recruitment/resume-import/parser/extract-text")
  >();
  return {
    ...actual,
    extractResumeText: (input: Parameters<typeof actual.extractResumeText>[0]) =>
      extractResumeTextSpy(input),
  };
});

const VALID_LLM_RESPONSE: LlmResumeResponse = {
  fullName: "Recovered Candidate",
  firstName: "Recovered",
  lastName: "Candidate",
  email: "recovered.candidate@example.com",
  phone: "+1-555-000-1111",
  location: "Hyderabad, India",
  headline: "HR Executive",
  professionalSummary: "Recovered via Gemini Vision fallback.",
  currentCompany: null,
  currentTitle: null,
  totalExperienceYears: null,
  linkedinUrl: null,
  githubUrl: null,
  portfolioUrl: null,
  experiences: [],
  educations: [],
  skills: [],
  projects: [],
  certifications: [],
};

describe("extraction-quality gate → Gemini Vision fallback (Divya scanned-PDF case)", () => {
  let parseResumeDocument: typeof import("@/lib/recruitment/resume-import/parser").parseResumeDocument;

  beforeEach(async () => {
    vi.resetModules();
    extractResumeTextSpy.mockClear();
    const mod = await import("@/lib/recruitment/resume-import/parser");
    parseResumeDocument = mod.parseResumeDocument;
  });

  it("falls back to Gemini Vision when extraction yields empty/untrustworthy text", async () => {
    const generator: LlmResumeGenerator = async () => ({
      ok: true,
      text: JSON.stringify(VALID_LLM_RESPONSE),
    });

    const { result, draftContent } = await parseResumeDocument({
      content: Buffer.from("%PDF-1.4 fake scanned pdf bytes"),
      fileName: "scanned-resume.pdf",
      mimeType: "application/pdf",
      llmGenerate: generator,
    });

    expect(result.ok).toBe(true);
    expect(draftContent.source).toBe("ai");
    expect(draftContent.mapped.personal.fullName).toBe("Recovered Candidate");
  });

  it("does not invoke Gemini for the cost-free public-apply path (forceDeterministic)", async () => {
    const generator = vi.fn<LlmResumeGenerator>(async () => ({
      ok: true,
      text: JSON.stringify(VALID_LLM_RESPONSE),
    }));

    const { result } = await parseResumeDocument({
      content: Buffer.from("%PDF-1.4 fake scanned pdf bytes"),
      fileName: "scanned-resume.pdf",
      mimeType: "application/pdf",
      llmGenerate: generator,
      forceDeterministic: true,
    });

    expect(generator).not.toHaveBeenCalled();
    // Still reports a clear, explicit failure rather than a silently empty candidate.
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("EMPTY_DOCUMENT");
    }
  });

  it("falls through to the deterministic EMPTY_DOCUMENT failure if Gemini fallback also fails (never silently empty)", async () => {
    const generator: LlmResumeGenerator = async () => ({
      ok: false,
      error: "simulated network failure",
      retryable: false,
    });

    const { result } = await parseResumeDocument({
      content: Buffer.from("%PDF-1.4 fake scanned pdf bytes"),
      fileName: "scanned-resume.pdf",
      mimeType: "application/pdf",
      llmGenerate: generator,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("EMPTY_DOCUMENT");
    }
  });
});
