import { describe, expect, it } from "vitest";
import {
  EMPTY_PARSED_RESUME_DRAFT,
  type ParsedResumeDraft,
} from "@/lib/recruitment/resume-import/parser/types";
import { detectResumeAmbiguity } from "@/lib/recruitment/resume-import/semantic/ambiguity";
import { runSemanticVerificationPipeline } from "@/lib/recruitment/resume-import/semantic";
import { parseSemanticVerificationOutput } from "@/lib/recruitment/resume-import/semantic/llm-verify-schema";
import { verifyResumeSemantics } from "@/lib/recruitment/resume-import/semantic/llm-verify";

function baseDraft(
  overrides: Partial<ParsedResumeDraft> = {}
): ParsedResumeDraft {
  const empty = EMPTY_PARSED_RESUME_DRAFT();
  return {
    ...empty,
    ...overrides,
    personal: { ...empty.personal, ...overrides.personal },
    professional: { ...empty.professional, ...overrides.professional },
  };
}

const AMBIGUOUS_TEXT = `
EXPERIENCE
Contributor at Something Odd
Did various things.
`;

describe("resume LLM verify contract", () => {
  it("rejects malformed Zod output", () => {
    const parsed = parseSemanticVerificationOutput({
      version: 1,
      decisions: [
        {
          type: "experience",
          action: "maybe",
          candidateId: "exp:0",
          reason: "x",
          evidence: ["y"],
          proposedSection: null,
        },
      ],
    });
    expect(parsed.ok).toBe(false);
  });

  it("accepts valid verification JSON", () => {
    const parsed = parseSemanticVerificationOutput({
      version: 1,
      decisions: [
        {
          type: "experience",
          action: "leave_empty",
          candidateId: "exp:0",
          reason: "Insufficient employment evidence",
          evidence: ["Contributor at Something Odd"],
          proposedSection: null,
        },
      ],
    });
    expect(parsed.ok).toBe(true);
  });

  it("falls back to deterministic draft when generate fails", async () => {
    const draft = baseDraft({
      experiences: [
        {
          title: "Contributor",
          company: "Something Odd",
          startDate: null,
          endDate: null,
          isCurrent: false,
          description: null,
        },
      ],
    });
    const ambiguity = detectResumeAmbiguity({
      draft,
      cleanedText: AMBIGUOUS_TEXT,
    });
    expect(ambiguity.needsVerification).toBe(true);

    const out = await runSemanticVerificationPipeline({
      draft,
      cleanedText: AMBIGUOUS_TEXT,
      generate: async () => ({
        ok: false,
        error: "Gemini unavailable",
        retryable: true,
      }),
    });

    expect(out.meta.attempted).toBe(true);
    expect(out.meta.llmSuccess).toBe(false);
    expect(out.meta.fallbackDeterministic).toBe(true);
    expect(out.draft.experiences).toHaveLength(1);
    expect(out.draft.experiences[0]?.company).toBe("Something Odd");
  });

  it("falls back on invalid JSON / Zod failure from generate", async () => {
    const draft = baseDraft({
      experiences: [
        {
          title: "Contributor",
          company: "Something Odd",
          startDate: null,
          endDate: null,
          isCurrent: false,
          description: null,
        },
      ],
    });

    const invalidJson = await runSemanticVerificationPipeline({
      draft,
      cleanedText: AMBIGUOUS_TEXT,
      generate: async () => ({
        ok: false,
        error: "Model response did not contain a JSON object.",
      }),
    });
    expect(invalidJson.meta.fallbackDeterministic).toBe(true);
    expect(invalidJson.draft).toEqual(draft);

    const zodFail = await verifyResumeSemantics({
      draft,
      ambiguity: detectResumeAmbiguity({ draft, cleanedText: AMBIGUOUS_TEXT }),
      generate: async () => ({
        ok: false,
        error: "Invalid semantic verification output.",
      }),
    });
    expect(zodFail.ok).toBe(false);
  });

  it("falls back on timeout-style errors", async () => {
    const draft = baseDraft({
      experiences: [
        {
          title: "Contributor",
          company: "Something Odd",
          startDate: null,
          endDate: null,
          isCurrent: false,
          description: null,
        },
      ],
    });
    const out = await runSemanticVerificationPipeline({
      draft,
      cleanedText: AMBIGUOUS_TEXT,
      generate: async () => ({
        ok: false,
        error: "The operation was aborted due to timeout",
        retryable: true,
      }),
    });
    expect(out.meta.fallbackDeterministic).toBe(true);
    expect(out.draft.experiences[0]?.title).toBe("Contributor");
  });

  it("skips LLM when no ambiguity", async () => {
    const draft = baseDraft({
      personal: {
        ...EMPTY_PARSED_RESUME_DRAFT().personal,
        fullName: "Alex Rivera",
      },
      professional: {
        ...EMPTY_PARSED_RESUME_DRAFT().professional,
        headline: "Engineer",
        currentTitle: "Software Engineer",
        currentCompany: "Acme Corp",
      },
      experiences: [
        {
          title: "Software Engineer",
          company: "Acme Corp",
          startDate: "2021-01-01",
          endDate: null,
          isCurrent: true,
          description: "Built APIs.",
        },
      ],
      educations: [
        {
          institution: "State University",
          degree: "B.Tech",
          field: "CS",
          graduationYear: 2018,
        },
      ],
    });
    const text = `
Alex Rivera
Engineer
EXPERIENCE
Software Engineer at Acme Corp
Jan 2021 – Present
Built APIs.
EDUCATION
B.Tech CS
State University
2018
`;
    let called = false;
    const out = await runSemanticVerificationPipeline({
      draft,
      cleanedText: text,
      generate: async () => {
        called = true;
        return { ok: false, error: "should not run" };
      },
    });
    expect(called).toBe(false);
    expect(out.meta.skipped).toBe(true);
    expect(out.meta.skipReason).toBe("no_ambiguity");
  });
});
