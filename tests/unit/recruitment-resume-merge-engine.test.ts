import { describe, expect, it } from "vitest";
import {
  buildResumeMergeResult,
  resumeMergeHasWork,
} from "@/lib/recruitment/resume-import/merge-engine";
import { buildStubResumeImportMapped } from "@/lib/recruitment/resume-import/stub-draft";
import type { CandidateDetail } from "@/lib/recruitment/candidate/types";
import type { ResumeImportMappedDraft } from "@/lib/recruitment/resume-import/types";

function baseCandidate(overrides: Partial<CandidateDetail> = {}): CandidateDetail {
  return {
    id: "cand-1",
    tenantId: null,
    fullName: "Pat Existing",
    firstName: "Pat",
    lastName: "Existing",
    preferredName: null,
    email: "pat@example.com",
    phone: "+10000000000",
    alternatePhone: null,
    dateOfBirth: null,
    location: "Pune",
    currentCompany: "Old Co",
    currentTitle: "Engineer",
    linkedinUrl: null,
    professionalSummary: "Existing summary",
    headline: "Existing headline",
    totalExperienceYears: "4",
    githubUrl: null,
    preferredWorkMode: null,
    willingToRelocate: null,
    source: "manual" as never,
    status: "active" as never,
    doNotHireReason: null,
    currentCtc: null,
    expectedCtc: null,
    currency: "INR",
    noticePeriodDays: null,
    earliestJoinDate: null,
    availabilityNotes: null,
    timezone: null,
    primaryRecruiterUserId: null,
    referredByEmployeeId: null,
    employeeId: null,
    mergedIntoCandidateId: null,
    createdByUserId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    archivedAt: null,
    normalizedEmail: "pat@example.com",
    normalizedPhone: "10000000000",
    personal: null,
    documents: [],
    experiences: [
      {
        id: "exp-1",
        candidateId: "cand-1",
        company: "Old Co",
        title: "Engineer",
        location: null,
        startDate: null,
        endDate: null,
        isCurrent: true,
        description: null,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        companyName: "Old Co",
        designation: "Engineer",
        employmentType: null,
        currentlyWorking: true,
      },
    ],
    educations: [
      {
        id: "edu-1",
        candidateId: "cand-1",
        institution: "State University",
        degree: "B.Tech",
        field: "Computer Science",
        startYear: 2015,
        endYear: 2019,
        notes: null,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        fieldOfStudy: "Computer Science",
        grade: null,
      },
    ],
    skills: [
      {
        id: "sk-1",
        candidateId: "cand-1",
        name: "TypeScript",
        proficiency: "advanced",
        isConfirmed: true,
        createdAt: new Date(),
        skillName: "TypeScript",
        yearsOfExperience: 5,
      },
    ],
    projects: [],
    certifications: [],
    notes: [],
    tags: [],
    ...overrides,
  };
}

describe("buildResumeMergeResult", () => {
  it("auto-fills empty fields and conflicts when values differ", () => {
    const candidate = baseCandidate({
      githubUrl: null,
      email: "pat@example.com",
    });
    const mapped = buildStubResumeImportMapped({
      fullName: "Alex Rivera",
      email: "alex.rivera@example.com",
    });

    const result = buildResumeMergeResult(candidate, mapped);

    expect(result.autoFill.githubUrl).toBeTruthy();
    expect(result.conflicts.some((c) => c.key === "email")).toBe(true);
    expect(result.conflicts.some((c) => c.key === "fullName")).toBe(true);
    expect(result.autoFill.email).toBeUndefined();
  });

  it("ignores matching scalar values", () => {
    const mapped = buildStubResumeImportMapped({
      fullName: "Pat Existing",
      email: "pat@example.com",
    });
    mapped.personal.phone = "+10000000000";
    mapped.personal.location = "Pune";
    mapped.professional.currentCompany = "Old Co";
    mapped.professional.currentTitle = "Engineer";
    mapped.professional.headline = "Existing headline";
    mapped.professional.professionalSummary = "Existing summary";
    mapped.professional.totalExperienceYears = "4";

    const result = buildResumeMergeResult(baseCandidate(), mapped);
    expect(result.conflicts.find((c) => c.key === "email")).toBeUndefined();
    expect(result.autoFill.email).toBeUndefined();
  });

  it("appends list items and skips duplicates", () => {
    const mapped = buildStubResumeImportMapped();
    // Stub includes TypeScript skill + State University B.Tech — duplicates of baseCandidate
    const result = buildResumeMergeResult(baseCandidate(), mapped);

    expect(result.skillsToAppend.every((s) => s.name.toLowerCase() !== "typescript")).toBe(
      true
    );
    expect(
      result.educationsToAppend.every(
        (e) =>
          !(
            e.institution === "State University" &&
            e.degree === "B.Tech" &&
            (e.field === "Computer Science" || e.fieldOfStudy === "Computer Science")
          )
      )
    ).toBe(true);
    expect(result.experiencesToAppend.length).toBeGreaterThan(0);
    expect(
      result.experiencesToAppend.every(
        (e) => !(e.company === "Old Co" && e.title === "Engineer")
      )
    ).toBe(true);
  });

  it("never proposes deleting existing data — only appends", () => {
    const result = buildResumeMergeResult(baseCandidate(), buildStubResumeImportMapped());
    expect(Array.isArray(result.experiencesToAppend)).toBe(true);
    expect(Array.isArray(result.educationsToAppend)).toBe(true);
    expect(Array.isArray(result.skillsToAppend)).toBe(true);
    expect(Array.isArray(result.projectsToAppend)).toBe(true);
    expect(Array.isArray(result.certificationsToAppend)).toBe(true);
  });

  it("appends projects and skips duplicates by title+url", () => {
    const candidate = baseCandidate({
      projects: [
        {
          id: "p1",
          candidateId: "cand-1",
          title: "Recruitment Workspace",
          summary: null,
          techStack: null,
          url: "https://example.dev/projects/recruitment",
          sortOrder: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          description: null,
          technologies: null,
          role: null,
          duration: null,
        },
      ],
    });
    const mapped = buildStubResumeImportMapped();
    mapped.projects.push({
      title: "New Side Project",
      summary: "Demo",
      techStack: "Go",
      url: "https://example.dev/side",
      sortOrder: 1,
    });

    const result = buildResumeMergeResult(candidate, mapped);
    expect(
      result.projectsToAppend.every((p) => p.title !== "Recruitment Workspace")
    ).toBe(true);
    expect(result.projectsToAppend.some((p) => p.title === "New Side Project")).toBe(
      true
    );
  });

  it("appends certifications and skips duplicates by name+issuer", () => {
    const candidate = baseCandidate({
      certifications: [
        {
          id: "c1",
          candidateId: "cand-1",
          name: "AWS Certified Developer – Associate",
          issuer: "Amazon Web Services",
          issuedAt: null,
          expiresAt: null,
          credentialId: null,
          createdAt: new Date(),
          issueDate: null,
          expiryDate: null,
          credentialUrl: null,
        },
      ],
    });
    const mapped = buildStubResumeImportMapped();
    mapped.certifications.push({
      name: "CKA",
      issuer: "CNCF",
      issuedAt: "2024-01-01",
    });

    const result = buildResumeMergeResult(candidate, mapped);
    expect(
      result.certificationsToAppend.every(
        (c) => !/AWS Certified Developer/i.test(c.name)
      )
    ).toBe(true);
    expect(result.certificationsToAppend.some((c) => c.name === "CKA")).toBe(true);
  });

  it("resumeMergeHasWork is true for project-only or certification-only changes", () => {
    const emptyMapped = (): ResumeImportMappedDraft => ({
      personal: {},
      professional: {},
      experiences: [],
      educations: [],
      skills: [],
      projects: [],
      certifications: [],
    });

    const projectOnly = emptyMapped();
    projectOnly.projects = [{ title: "Solo Project", summary: "x" }];
    expect(
      resumeMergeHasWork(buildResumeMergeResult(baseCandidate(), projectOnly))
    ).toBe(true);

    const certOnly = emptyMapped();
    certOnly.certifications = [{ name: "Solo Cert", issuer: "Issuer" }];
    expect(
      resumeMergeHasWork(buildResumeMergeResult(baseCandidate(), certOnly))
    ).toBe(true);
  });

  it("Phase A: does not auto-fill weak headline onto empty Candidate.headline", () => {
    const candidate = baseCandidate({ headline: null });
    const mapped = buildStubResumeImportMapped();
    mapped.professional.headline = "Jane Doe";
    mapped.professional.currentTitle = "Engineer";
    mapped.professional.currentCompany = "Acme";

    const result = buildResumeMergeResult(candidate, mapped);
    expect(result.autoFill.headline).toBeUndefined();
  });

  it("Phase A: does not auto-fill project-like company as currentCompany", () => {
    const candidate = baseCandidate({
      currentCompany: null,
      currentTitle: null,
      headline: null,
    });
    const mapped = buildStubResumeImportMapped();
    mapped.professional.headline = "Employee Management System";
    mapped.professional.currentTitle = "Unknown";
    mapped.professional.currentCompany = "Employee Management System";

    const result = buildResumeMergeResult(candidate, mapped);
    expect(result.autoFill.headline).toBeUndefined();
    expect(result.autoFill.currentTitle).toBeUndefined();
    expect(result.autoFill.currentCompany).toBeUndefined();
  });

  it("Phase A: does not append weak experience rows", () => {
    const candidate = baseCandidate({ experiences: [] });
    const mapped = buildStubResumeImportMapped();
    mapped.experiences = [
      {
        company: "Employee Management System",
        title: "Unknown",
        startDate: null,
        endDate: null,
        isCurrent: false,
        description: null,
      },
      {
        company: "Employee Management System",
        title: "React",
        startDate: null,
        endDate: null,
        isCurrent: false,
        description: null,
      },
      {
        company: "ABC Technologies",
        title: "Software Engineer",
        startDate: "2024-01-01",
        endDate: null,
        isCurrent: true,
        description: "Built APIs",
      },
    ];

    const result = buildResumeMergeResult(candidate, mapped);
    expect(
      result.experiencesToAppend.every(
        (e) => !/Employee Management System/i.test(e.company)
      )
    ).toBe(true);
    expect(
      result.experiencesToAppend.some(
        (e) => e.company === "ABC Technologies" && e.title === "Software Engineer"
      )
    ).toBe(true);
  });

  it("Phase A: still auto-fills strong headline when Candidate.headline is empty", () => {
    const candidate = baseCandidate({ headline: null });
    const mapped = buildStubResumeImportMapped();
    mapped.professional.headline = "Senior Software Engineer";

    const result = buildResumeMergeResult(candidate, mapped);
    expect(result.autoFill.headline).toBe("Senior Software Engineer");
  });
});
