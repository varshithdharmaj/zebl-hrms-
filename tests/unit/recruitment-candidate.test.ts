import { describe, expect, it } from "vitest";
import { CandidateStatus, CandidateSource } from "@/generated/prisma/enums";
import {
  createCandidateSchema,
  updateCandidateSchema,
  candidateIdSchema,
} from "@/lib/validation/schemas/recruitment/candidates";

describe("candidate enums", () => {
  it("contains newly added status values", () => {
    expect(CandidateStatus.merged).toBe("merged");
    expect(CandidateStatus.active).toBe("active");
    expect(CandidateStatus.talent_pool).toBe("talent_pool");
  });

  it("contains newly added source values", () => {
    expect(CandidateSource.manual).toBe("manual");
    expect(CandidateSource.import).toBe("import");
    expect(CandidateSource.employee_referral).toBe("employee_referral");
    expect(CandidateSource.career_portal_future).toBe("career_portal_future");
  });
});

describe("candidate zod schemas", () => {
  it("validates a valid create payload", () => {
    const parsed = createCandidateSchema.safeParse({
      fullName: "John Doe",
      email: "john.doe@example.com",
      phone: "+1234567890",
      source: "manual",
      status: "active",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.fullName).toBe("John Doe");
      expect(parsed.data.source).toBe(CandidateSource.manual);
      expect(parsed.data.status).toBe(CandidateStatus.active);
    }
  });

  it("accepts empty optional fields and applies defaults", () => {
    const parsed = createCandidateSchema.safeParse({
      fullName: "Jane Smith",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.source).toBe(CandidateSource.manual_upload);
      expect(parsed.data.status).toBe(CandidateStatus.active);
      expect(parsed.data.email).toBeUndefined();
      expect(parsed.data.phone).toBeUndefined();
    }
  });

  it("rejects invalid email formats", () => {
    const parsed = createCandidateSchema.safeParse({
      fullName: "Jane Smith",
      email: "not-an-email",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0].message).toBe("Invalid email format.");
    }
  });

  it("rejects invalid phone formats", () => {
    const parsed = createCandidateSchema.safeParse({
      fullName: "Jane Smith",
      phone: "invalid-phone-123",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0].message).toBe("Invalid phone number format.");
    }
  });

  it("validates a valid update payload", () => {
    const parsed = updateCandidateSchema.safeParse({
      id: "cand-123",
      fullName: "John Updated",
      status: "talent_pool",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.id).toBe("cand-123");
      expect(parsed.data.fullName).toBe("John Updated");
      expect(parsed.data.status).toBe(CandidateStatus.talent_pool);
    }
  });

  it("validates candidate ID schema", () => {
    const parsed = candidateIdSchema.safeParse({ id: "cand-123" });
    expect(parsed.success).toBe(true);
    expect(candidateIdSchema.safeParse({ id: "" }).success).toBe(false);
  });

  it("accepts phase-1 profile extension fields on create", () => {
    const parsed = createCandidateSchema.safeParse({
      fullName: "Alex Rivera",
      headline: "Senior React Developer | 5 Years | FinTech",
      professionalSummary: "Full-stack engineer with product focus.",
      totalExperienceYears: "5.5",
      githubUrl: "https://github.com/alex",
      preferredWorkMode: "hybrid",
      willingToRelocate: "true",
      preferredLocation: "Bangalore",
      portfolioUrl: "https://alex.dev",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.headline).toBe("Senior React Developer | 5 Years | FinTech");
      expect(parsed.data.totalExperienceYears).toBe("5.5");
      expect(parsed.data.preferredWorkMode).toBe("hybrid");
      expect(parsed.data.willingToRelocate).toBe(true);
      expect(parsed.data.preferredLocation).toBe("Bangalore");
      expect(parsed.data.portfolioUrl).toBe("https://alex.dev");
    }
  });

  it("rejects invalid total experience years", () => {
    const parsed = createCandidateSchema.safeParse({
      fullName: "Alex Rivera",
      totalExperienceYears: "five",
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts profile fields on update", () => {
    const parsed = updateCandidateSchema.safeParse({
      id: "cand-123",
      headline: "Staff Engineer",
      preferredWorkMode: "remote",
      willingToRelocate: false,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.headline).toBe("Staff Engineer");
      expect(parsed.data.preferredWorkMode).toBe("remote");
      expect(parsed.data.willingToRelocate).toBe(false);
    }
  });

  it("re-parses form date fields after action→service round-trip", () => {
    const first = updateCandidateSchema.safeParse({
      id: "cand-123",
      fullName: "Jane Smith",
      dateOfBirth: "1990-05-15",
      earliestJoinDate: "",
    });
    expect(first.success).toBe(true);
    if (!first.success) return;

    expect(first.data.dateOfBirth).toBeInstanceOf(Date);
    expect(first.data.earliestJoinDate).toBeNull();

    const second = updateCandidateSchema.safeParse(first.data);
    expect(second.success).toBe(true);
    if (!second.success) return;
    expect(second.data.dateOfBirth).toBeInstanceOf(Date);
    expect(second.data.earliestJoinDate).toBeNull();
  });
});
