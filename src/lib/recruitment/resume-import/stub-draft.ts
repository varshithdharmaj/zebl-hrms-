import type {
  ResumeImportDraftContent,
  ResumeImportMappedDraft,
} from "@/lib/recruitment/resume-import/types";

/** Deterministic stub payload for Phase 1 (no parser). */
export function buildStubResumeImportMapped(
  candidateHint?: { fullName?: string | null; email?: string | null }
): ResumeImportMappedDraft {
  const name = candidateHint?.fullName?.trim() || "Alex Rivera";
  return {
    personal: {
      fullName: name,
      firstName: name.split(/\s+/)[0] ?? "Alex",
      lastName: name.split(/\s+/).slice(1).join(" ") || "Rivera",
      email: candidateHint?.email?.trim() || "alex.rivera@example.com",
      phone: "+1-555-0100",
      location: "Bengaluru, India",
    },
    professional: {
      headline: "Full-Stack Engineer · TypeScript & Node",
      professionalSummary:
        "Engineer with experience building HR and recruitment workflows. Focused on reliable APIs, clean domain models, and pragmatic delivery.",
      currentCompany: "Northwind Labs",
      currentTitle: "Senior Software Engineer",
      githubUrl: "https://github.com/example-alex",
      linkedinUrl: "https://linkedin.com/in/example-alex",
      portfolioUrl: "https://example.dev",
      totalExperienceYears: "6.5",
      preferredWorkMode: "hybrid",
      willingToRelocate: false,
    },
    experiences: [
      {
        company: "Northwind Labs",
        title: "Senior Software Engineer",
        location: "Bengaluru",
        startDate: "2022-03-01",
        endDate: null,
        isCurrent: true,
        description: "Owned candidate profile and document workflows.",
        sortOrder: 0,
      },
      {
        company: "Contoso Soft",
        title: "Software Engineer",
        location: "Remote",
        startDate: "2019-06-01",
        endDate: "2022-02-28",
        isCurrent: false,
        description: "Built internal tooling and REST APIs.",
        sortOrder: 1,
      },
    ],
    educations: [
      {
        institution: "State University",
        degree: "B.Tech",
        field: "Computer Science",
        startYear: 2015,
        endYear: 2019,
        grade: "8.2 CGPA",
        sortOrder: 0,
      },
    ],
    skills: [
      { name: "TypeScript", proficiency: "advanced", yearsOfExperience: 5 },
      { name: "Node.js", proficiency: "advanced", yearsOfExperience: 5 },
      { name: "PostgreSQL", proficiency: "intermediate", yearsOfExperience: 4 },
      { name: "React", proficiency: "intermediate", yearsOfExperience: 4 },
    ],
    projects: [
      {
        title: "Recruitment Workspace",
        summary: "Internal ATS modules for pipeline and documents.",
        techStack: "Next.js, Prisma, PostgreSQL",
        url: "https://example.dev/projects/recruitment",
        role: "Lead engineer",
        duration: "2023–2024",
        sortOrder: 0,
      },
    ],
    certifications: [
      {
        name: "AWS Certified Developer – Associate",
        issuer: "Amazon Web Services",
        issuedAt: "2023-05-01",
        expiresAt: "2026-05-01",
        credentialId: "AWS-DEV-STUB-001",
        credentialUrl: null,
      },
    ],
  };
}

export function buildStubResumeImportContent(input: {
  documentId?: string | null;
  candidateHint?: { fullName?: string | null; email?: string | null };
}): ResumeImportDraftContent {
  const mapped = buildStubResumeImportMapped(input.candidateHint);
  return {
    version: 1,
    source: "stub",
    documentId: input.documentId ?? null,
    raw: { ...mapped, _stub: true },
    mapped,
    fieldConfidence: {
      "personal.fullName": 0.95,
      "personal.email": 0.9,
      "professional.headline": 0.85,
      "professional.professionalSummary": 0.8,
      "section.experiences": 0.75,
      "section.skills": 0.8,
    },
    metadata: {
      parserVersion: "stub-v1",
      note: "Phase 1 stub draft — replace with parser output later.",
    },
  };
}
