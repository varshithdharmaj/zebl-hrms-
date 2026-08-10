import { describe, expect, it } from "vitest";
import { detectResumeAmbiguity } from "@/lib/recruitment/resume-import/semantic/ambiguity";
import {
  EMPTY_PARSED_RESUME_DRAFT,
  type ParsedResumeDraft,
} from "@/lib/recruitment/resume-import/parser/types";

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

const STRONG_EXP_TEXT = `
Alex Rivera
Senior Backend Engineer
alex@example.com

EXPERIENCE
Senior Software Engineer at Acme Corp
Jan 2021 – Present
Built APIs.

Software Engineer at Beta LLC
Jun 2018 – Dec 2020
Maintained services.

EDUCATION
B.Tech Computer Science
State University
2018

SKILLS
TypeScript, Node.js
`;

describe("resume ambiguity detection", () => {
  it("does not request LLM for strong dated employment", () => {
    const draft = baseDraft({
      personal: {
        ...EMPTY_PARSED_RESUME_DRAFT().personal,
        fullName: "Alex Rivera",
        email: "alex@example.com",
      },
      professional: {
        ...EMPTY_PARSED_RESUME_DRAFT().professional,
        headline: "Senior Backend Engineer",
        currentTitle: "Senior Software Engineer",
        currentCompany: "Acme Corp",
      },
      experiences: [
        {
          title: "Senior Software Engineer",
          company: "Acme Corp",
          startDate: "2021-01-01",
          endDate: null,
          isCurrent: true,
          description: "Built APIs.",
        },
        {
          title: "Software Engineer",
          company: "Beta LLC",
          startDate: "2018-06-01",
          endDate: "2020-12-01",
          isCurrent: false,
          description: "Maintained services.",
        },
      ],
      educations: [
        {
          institution: "State University",
          degree: "B.Tech",
          field: "Computer Science",
          graduationYear: 2018,
        },
      ],
      skills: ["TypeScript", "Node.js"],
    });

    const amb = detectResumeAmbiguity({
      draft,
      cleanedText: STRONG_EXP_TEXT,
    });
    expect(amb.needsVerification).toBe(false);
    expect(amb.reasons).toEqual([]);
  });

  it("flags ambiguous experience when title is weak", () => {
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
    const text = `
EXPERIENCE
Contributor at Something Odd
Did various things.
`;
    const amb = detectResumeAmbiguity({ draft, cleanedText: text });
    expect(amb.needsVerification).toBe(true);
    expect(amb.reasons).toContain("weak_experience");
  });

  it("flags experience/project ambiguity for project-like employers", () => {
    const draft = baseDraft({
      experiences: [
        {
          title: "Developer",
          company: "Employee Management System",
          startDate: "2022-01-01",
          endDate: "2022-06-01",
          isCurrent: false,
          description: "Built CRUD screens.",
        },
      ],
    });
    const amb = detectResumeAmbiguity({
      draft,
      cleanedText: "EXPERIENCE\nDeveloper at Employee Management System",
    });
    expect(amb.reasons).toContain("experience_project_ambiguity");
  });

  it("flags project ambiguity for job-title-like project names", () => {
    const draft = baseDraft({
      projects: [
        {
          title: "Senior Software Engineer",
          summary: null,
          techStack: null,
          url: null,
          duration: null,
        },
      ],
    });
    const amb = detectResumeAmbiguity({
      draft,
      cleanedText: "PROJECTS\nSenior Software Engineer",
    });
    expect(amb.reasons).toContain("project_ambiguity");
  });

  it("flags education ambiguity when degree lacks institution", () => {
    const draft = baseDraft({
      educations: [
        {
          institution: "",
          degree: "B.Tech Computer Science",
          field: null,
          graduationYear: null,
        },
      ],
    });
    const amb = detectResumeAmbiguity({
      draft,
      cleanedText: "EDUCATION\nB.Tech Computer Science",
    });
    expect(amb.reasons).toContain("education_ambiguity");
  });

  it("flags current_role ambiguity for multiple Present roles", () => {
    const draft = baseDraft({
      experiences: [
        {
          title: "Engineer",
          company: "A Co",
          startDate: "2020-01-01",
          endDate: null,
          isCurrent: true,
          description: null,
        },
        {
          title: "Consultant",
          company: "B Co",
          startDate: "2021-01-01",
          endDate: null,
          isCurrent: true,
          description: null,
        },
      ],
    });
    const amb = detectResumeAmbiguity({
      draft,
      cleanedText: "EXPERIENCE\nEngineer at A Co — Present\nConsultant at B Co — Present",
    });
    expect(amb.reasons).toContain("current_role_ambiguity");
  });
});
