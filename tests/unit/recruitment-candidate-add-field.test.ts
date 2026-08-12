import { describe, expect, it, vi, beforeEach } from "vitest";
import type { CandidateDetail } from "@/lib/recruitment/candidate/types";
import {
  buildAddableFieldUpdatePayload,
  CANDIDATE_ADDABLE_FIELDS,
  getAddableFieldDef,
  hasMissingAddableFields,
  listMissingAddableFields,
  validateAddableFieldValue,
} from "@/lib/recruitment/candidate/addable-fields";

function baseCandidate(overrides: Partial<CandidateDetail> = {}): CandidateDetail {
  return {
    id: "cand-1",
    fullName: "Ada Lovelace",
    firstName: "Ada",
    lastName: "Lovelace",
    preferredName: null,
    email: "ada@example.com",
    phone: null,
    alternatePhone: null,
    dateOfBirth: null,
    location: null,
    currentCompany: null,
    currentTitle: null,
    linkedinUrl: null,
    githubUrl: null,
    professionalSummary: null,
    headline: null,
    totalExperienceYears: null,
    preferredWorkMode: null,
    willingToRelocate: null,
    source: "manual_upload",
    status: "active",
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
    createdByUserId: null,
    normalizedEmail: "ada@example.com",
    normalizedPhone: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    deletedAt: null,
    personal: null,
    experiences: [],
    educations: [],
    skills: [],
    projects: [],
    certifications: [],
    documents: [],
    notes: [],
    ...overrides,
  } as CandidateDetail;
}

describe("candidate addable fields config", () => {
  it("lists only empty supported fields", () => {
    const candidate = baseCandidate({
      expectedCtc: "1800000",
      linkedinUrl: "https://linkedin.com/in/ada",
      personal: {
        candidateId: "cand-1",
        nationality: null,
        currentLocation: null,
        preferredLocation: "Hyderabad",
        noticePeriod: null,
        availabilityDate: null,
        linkedinUrl: null,
        portfolioUrl: null,
      },
    });

    const missing = listMissingAddableFields(candidate).map((f) => f.key);
    expect(missing).toContain("currentCtc");
    expect(missing).toContain("noticePeriodDays");
    expect(missing).toContain("portfolioUrl");
    expect(missing).toContain("location");
    expect(missing).toContain("dateOfBirth");
    expect(missing).toContain("nationality");
    expect(missing).toContain("githubUrl");
    expect(missing).toContain("headline");
    expect(missing).not.toContain("expectedCtc");
    expect(missing).not.toContain("linkedinUrl");
    expect(missing).not.toContain("preferredLocation");
  });

  it("hides Add Field when every supported field is filled", () => {
    const candidate = baseCandidate({
      expectedCtc: "1",
      currentCtc: "1",
      noticePeriodDays: 30,
      linkedinUrl: "https://linkedin.com/in/ada",
      githubUrl: "https://github.com/ada",
      location: "Hyderabad",
      dateOfBirth: new Date("1990-01-01"),
      headline: "Engineer",
      currentCompany: "Acme",
      currentTitle: "SWE",
      totalExperienceYears: "5",
      earliestJoinDate: new Date("2026-09-01"),
      preferredWorkMode: "hybrid" as CandidateDetail["preferredWorkMode"],
      alternatePhone: "+919999999999",
      professionalSummary: "Summary",
      availabilityNotes: "Notes",
      personal: {
        candidateId: "cand-1",
        nationality: "Indian",
        currentLocation: null,
        preferredLocation: "Bangalore",
        noticePeriod: null,
        availabilityDate: null,
        linkedinUrl: null,
        portfolioUrl: "https://ada.dev",
      },
    });

    expect(hasMissingAddableFields(candidate)).toBe(false);
    expect(listMissingAddableFields(candidate)).toEqual([]);
  });

  it("builds a single-field partial update payload", () => {
    const field = getAddableFieldDef("expectedCtc");
    expect(field).toBeDefined();
    const payload = buildAddableFieldUpdatePayload("cand-1", field!, "2500000");
    expect(payload).toEqual({ id: "cand-1", expectedCtc: "2500000" });
    expect(Object.keys(payload)).toEqual(["id", "expectedCtc"]);
  });

  it("reuses updateCandidateSchema validation for money fields", () => {
    const field = getAddableFieldDef("currentCtc")!;
    expect(validateAddableFieldValue(field, "")).toMatch(/required/i);
    expect(validateAddableFieldValue(field, "abc")).toMatch(/valid amount/i);
    expect(validateAddableFieldValue(field, "1500000.50")).toBeNull();
  });

  it("validates notice period as a non-negative integer", () => {
    const field = getAddableFieldDef("noticePeriodDays")!;
    expect(validateAddableFieldValue(field, "-1")).toBeTruthy();
    expect(validateAddableFieldValue(field, "30")).toBeNull();
  });

  it("maps nationality and portfolio through form convenience keys", () => {
    const nationality = getAddableFieldDef("nationality")!;
    const portfolio = getAddableFieldDef("portfolioUrl")!;
    expect(nationality.toUpdatePayload("Indian")).toEqual({ nationality: "Indian" });
    expect(portfolio.toUpdatePayload("https://site.example")).toEqual({
      portfolioUrl: "https://site.example",
    });
  });

  it("does not include collection fields in addable config", () => {
    const keys = CANDIDATE_ADDABLE_FIELDS.map((f) => f.key);
    expect(keys).not.toContain("skills");
    expect(keys).not.toContain("experiences");
    expect(keys).not.toContain("educations");
    expect(keys).not.toContain("certifications");
  });
});

describe("updateCandidateAction single-field add", () => {
  const updateMock = vi.fn(async () => undefined);

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("submits only the selected field through updateCandidateAction", async () => {
    vi.doMock("@/lib/recruitment/config/feature-flags", () => ({
      isRecruitmentModuleEnabled: () => true,
    }));
    vi.doMock("@/lib/auth-guards", () => ({
      requireHROrSuperAdminSession: vi.fn(async () => ({
        userId: "user-hr",
        role: "hr",
        email: "hr@example.com",
      })),
      requireRecruitmentAdminSession: vi.fn(async () => ({
        userId: "user-hr",
        role: "hr",
        email: "hr@example.com",
      })),
      getSessionOrThrow: vi.fn(async () => ({
        userId: "user-hr",
        role: "hr",
        email: "hr@example.com",
      })),
    }));
    vi.doMock("@/lib/recruitment/services/candidate-service", () => ({
      createCandidateService: () => ({
        updateCandidate: (...args: unknown[]) => updateMock(...args),
      }),
    }));
    vi.doMock("next/cache", () => ({
      revalidatePath: vi.fn(),
    }));

    const { updateCandidateAction } = await import("@/actions/recruitment-candidates");
    const field = getAddableFieldDef("linkedinUrl")!;
    const payload = buildAddableFieldUpdatePayload(
      "cand-1",
      field,
      "https://linkedin.com/in/ada"
    );

    const result = await updateCandidateAction({}, payload);
    expect(result.error).toBeUndefined();
    expect(result.success).toMatch(/updated/i);
    expect(updateMock).toHaveBeenCalledTimes(1);
    const [, id, data] = updateMock.mock.calls[0] as [unknown, string, Record<string, unknown>];
    expect(id).toBe("cand-1");
    expect(data).toMatchObject({ id: "cand-1", linkedinUrl: "https://linkedin.com/in/ada" });
    expect(data).not.toHaveProperty("expectedCtc");
    expect(data).not.toHaveProperty("fullName");
  });
});
