import { describe, expect, it } from "vitest";
import {
  assertJobStatusTransition,
  isJobStatusTransitionAllowed,
  timestampsForStatus,
} from "@/lib/recruitment/job/status-transitions";
import { composeRequirements, splitRequirements } from "@/lib/recruitment/job/requirements-skills";
import { RecruitmentDomainError } from "@/lib/recruitment/shared/errors";
import {
  createJobOpeningSchema,
  closeJobOpeningSchema,
  jobOpeningListFiltersSchema,
} from "@/lib/validation/schemas/recruitment/jobs";

describe("job status transitions", () => {
  it("allows draft → open and open → closed", () => {
    expect(isJobStatusTransitionAllowed("draft", "open")).toBe(true);
    expect(isJobStatusTransitionAllowed("open", "closed")).toBe(true);
    expect(isJobStatusTransitionAllowed("closed", "open")).toBe(true);
  });

  it("rejects illegal transitions", () => {
    expect(isJobStatusTransitionAllowed("draft", "filled")).toBe(false);
    expect(() => assertJobStatusTransition("draft", "filled")).toThrow(RecruitmentDomainError);
  });

  it("sets timestamps for open/closed/filled", () => {
    const open = timestampsForStatus("open");
    expect(open.publishedAt).toBeInstanceOf(Date);
    expect(open.closedAt).toBeNull();
    const closed = timestampsForStatus("closed");
    expect(closed.closedAt).toBeInstanceOf(Date);
  });
});

describe("requirements/skills composition", () => {
  it("round-trips skills marker", () => {
    const composed = composeRequirements("Need React", "TypeScript, Prisma");
    const split = splitRequirements(composed);
    expect(split.requirements).toBe("Need React");
    expect(split.skillsText).toBe("TypeScript, Prisma");
  });
});

describe("job opening zod schemas", () => {
  it("validates create payload", () => {
    const parsed = createJobOpeningSchema.safeParse({
      title: "Senior Engineer",
      openingsCount: 2,
      employmentType: "full_time",
      publish: false,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects compensation min > max", () => {
    const parsed = createJobOpeningSchema.safeParse({
      title: "Engineer",
      openingsCount: 1,
      employmentType: "full_time",
      compensationMin: "100",
      compensationMax: "50",
    });
    expect(parsed.success).toBe(false);
  });

  it("requires close reason", () => {
    const parsed = closeJobOpeningSchema.safeParse({ id: "job-1", reason: "" });
    expect(parsed.success).toBe(false);
  });

  it("parses list filters with defaults", () => {
    const parsed = jobOpeningListFiltersSchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.status).toBe("all");
    expect(parsed.pageSize).toBe(25);
  });
});
