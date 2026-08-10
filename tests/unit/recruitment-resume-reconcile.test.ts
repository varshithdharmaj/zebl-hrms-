import { describe, expect, it } from "vitest";
import {
  EMPTY_PARSED_RESUME_DRAFT,
  type ParsedResumeDraft,
} from "@/lib/recruitment/resume-import/parser/types";
import { reconcileSemanticVerification } from "@/lib/recruitment/resume-import/semantic/reconcile";
import type { SemanticVerificationResult } from "@/lib/recruitment/resume-import/semantic/llm-verify-schema";

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

const SOURCE = `
Jane Marie Doe
Product Engineer

EXPERIENCE
Software Engineer at Contoso Soft
Jun 2019 – Dec 2021

PROJECTS
Employee Management System
Academic CRUD demo.

EDUCATION
B.Tech Computer Science
State University
`;

describe("resume semantic reconciliation", () => {
  it("accepts supported reject of weak experience", () => {
    const draft = baseDraft({
      personal: {
        ...EMPTY_PARSED_RESUME_DRAFT().personal,
        fullName: "Jane Marie Doe",
      },
      experiences: [
        {
          title: "Software Engineer",
          company: "Contoso Soft",
          startDate: "2019-06-01",
          endDate: "2021-12-01",
          isCurrent: false,
          description: null,
        },
      ],
    });
    const verification: SemanticVerificationResult = {
      version: 1,
      decisions: [
        {
          type: "experience",
          action: "accept",
          candidateId: "exp:0",
          reason: "Clear employment record",
          evidence: ["Software Engineer at Contoso Soft"],
          proposedSection: null,
        },
      ],
    };
    const out = reconcileSemanticVerification({
      draft,
      verification,
      sourceText: SOURCE,
    });
    expect(out.accepted).toBe(1);
    expect(out.draft.experiences).toHaveLength(1);
  });

  it("rejects unsupported decisions missing source evidence", () => {
    const draft = baseDraft({
      experiences: [
        {
          title: "Software Engineer",
          company: "Contoso Soft",
          startDate: "2019-06-01",
          endDate: "2021-12-01",
          isCurrent: false,
          description: null,
        },
      ],
    });
    const verification: SemanticVerificationResult = {
      version: 1,
      decisions: [
        {
          type: "experience",
          action: "reject",
          candidateId: "exp:0",
          reason: "Invented evidence",
          evidence: ["Worked as CTO at Imaginary Corp"],
          proposedSection: null,
        },
      ],
    };
    const out = reconcileSemanticVerification({
      draft,
      verification,
      sourceText: SOURCE,
    });
    expect(out.unsupported).toBe(1);
    expect(out.draft.experiences).toHaveLength(1);
  });

  it("rejects name → headline accept without deterministic headline", () => {
    const draft = baseDraft({
      personal: {
        ...EMPTY_PARSED_RESUME_DRAFT().personal,
        fullName: "Jane Marie Doe",
      },
      professional: {
        ...EMPTY_PARSED_RESUME_DRAFT().professional,
        headline: null,
      },
    });
    const verification: SemanticVerificationResult = {
      version: 1,
      decisions: [
        {
          type: "headline",
          action: "accept",
          candidateId: "headline",
          reason: "Use name as headline",
          evidence: ["Jane Marie Doe"],
          proposedSection: null,
        },
      ],
    };
    const out = reconcileSemanticVerification({
      draft,
      verification,
      sourceText: SOURCE,
    });
    expect(out.rejected).toBeGreaterThanOrEqual(1);
    expect(out.draft.professional.headline).toBeNull();
  });

  it("rejects project → experience reclassification", () => {
    const draft = baseDraft({
      projects: [
        {
          title: "Employee Management System",
          summary: "Academic CRUD demo.",
          techStack: null,
          url: null,
          duration: null,
        },
      ],
    });
    const verification: SemanticVerificationResult = {
      version: 1,
      decisions: [
        {
          type: "project",
          action: "reclassify",
          candidateId: "proj:0",
          reason: "Sounds like a job",
          evidence: ["Employee Management System"],
          proposedSection: "experience",
        },
      ],
    };
    const out = reconcileSemanticVerification({
      draft,
      verification,
      sourceText: SOURCE,
    });
    expect(out.rejected).toBe(1);
    expect(out.draft.projects).toHaveLength(1);
    expect(out.draft.experiences).toHaveLength(0);
  });

  it("rejects education → experience reclassification", () => {
    const draft = baseDraft({
      educations: [
        {
          institution: "State University",
          degree: "B.Tech",
          field: "Computer Science",
          graduationYear: null,
        },
      ],
    });
    const verification: SemanticVerificationResult = {
      version: 1,
      decisions: [
        {
          type: "education",
          action: "reclassify",
          candidateId: "edu:0",
          reason: "Treat as employment",
          evidence: ["State University"],
          proposedSection: "experience",
        },
      ],
    };
    const out = reconcileSemanticVerification({
      draft,
      verification,
      sourceText: SOURCE,
    });
    expect(out.rejected).toBe(1);
    expect(out.draft.educations).toHaveLength(1);
    expect(out.draft.experiences).toHaveLength(0);
  });

  it("rejects invented employer via unsupported evidence", () => {
    const draft = baseDraft({
      experiences: [
        {
          title: "Software Engineer",
          company: "Contoso Soft",
          startDate: "2019-06-01",
          endDate: "2021-12-01",
          isCurrent: false,
          description: null,
        },
      ],
    });
    const verification: SemanticVerificationResult = {
      version: 1,
      decisions: [
        {
          type: "experience",
          action: "accept",
          candidateId: "exp:0",
          reason: "Add invented employer context",
          evidence: ["Hired by FakeCorp International"],
          proposedSection: null,
        },
      ],
    };
    const out = reconcileSemanticVerification({
      draft,
      verification,
      sourceText: SOURCE,
    });
    expect(out.unsupported).toBe(1);
  });

  it("reclassifies experience → project when evidence supports", () => {
    const draft = baseDraft({
      experiences: [
        {
          title: "Developer",
          company: "Employee Management System",
          startDate: null,
          endDate: null,
          isCurrent: false,
          description: "Academic CRUD demo.",
        },
      ],
    });
    const verification: SemanticVerificationResult = {
      version: 1,
      decisions: [
        {
          type: "experience",
          action: "reclassify",
          candidateId: "exp:0",
          reason: "This is a project title",
          evidence: ["Employee Management System", "Academic CRUD demo."],
          proposedSection: "projects",
        },
      ],
    };
    const out = reconcileSemanticVerification({
      draft,
      verification,
      sourceText: SOURCE,
    });
    expect(out.accepted).toBe(1);
    expect(out.draft.experiences).toHaveLength(0);
    expect(out.draft.projects.some((p) => /Employee Management/i.test(p.title))).toBe(
      true
    );
  });
});
