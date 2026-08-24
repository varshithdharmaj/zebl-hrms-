import { describe, expect, it, vi, beforeEach } from "vitest";

const findMany = vi.fn();
const findFirst = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    jobOpening: {
      findMany: (...args: unknown[]) => findMany(...args),
      findFirst: (...args: unknown[]) => findFirst(...args),
    },
  },
}));

import { listPublicJobs, resolvePublicJobBySlug, getOpenPublicJobById } from "@/lib/recruitment/public-apply/public-job-query";

describe("public job query — visibility filter", () => {
  beforeEach(() => {
    findMany.mockReset();
    findFirst.mockReset();
  });

  it("listPublicJobs filters on status=open AND isPubliclyListed=true", async () => {
    findMany.mockResolvedValue([]);
    await listPublicJobs();
    const args = findMany.mock.calls[0][0];
    expect(args.where).toMatchObject({ status: "open", isPubliclyListed: true, deletedAt: null });
  });

  it("resolvePublicJobBySlug uses the identical visibility filter as the list query", async () => {
    findFirst.mockResolvedValue(null);
    await resolvePublicJobBySlug("some-slug");
    const args = findFirst.mock.calls[0][0];
    expect(args.where).toMatchObject({
      publicSlug: "some-slug",
      status: "open",
      isPubliclyListed: true,
      deletedAt: null,
    });
  });

  it("returns null for an unpublished job (isPubliclyListed=false in DB, filtered out at query level)", async () => {
    // Simulates the DB filter excluding the row — findFirst never returns
    // a row for a job that fails the WHERE clause.
    findFirst.mockResolvedValue(null);
    const result = await resolvePublicJobBySlug("unpublished-job");
    expect(result).toBeNull();
  });

  it("returns null for a closed job (status != open, filtered out at query level)", async () => {
    findFirst.mockResolvedValue(null);
    const result = await resolvePublicJobBySlug("closed-job");
    expect(result).toBeNull();
  });

  it("getOpenPublicJobById returns only write-path fields (id/title/ownerRecruiterUserId), never candidate-facing-DTO extras", async () => {
    findFirst.mockResolvedValue({ id: "job-1", title: "Engineer", ownerRecruiterUserId: "user-1" });
    const result = await getOpenPublicJobById("job-1");
    expect(result).toEqual({ id: "job-1", title: "Engineer", ownerRecruiterUserId: "user-1" });
    const selectArg = findFirst.mock.calls[0][0].select;
    expect(selectArg).toEqual({ id: true, title: true, ownerRecruiterUserId: true });
  });

  it("resolvePublicJobBySlug returns a DTO with no internal status/compensation fields when found", async () => {
    findFirst.mockResolvedValue({
      id: "job-1",
      publicSlug: "engineer",
      title: "Engineer",
      department: "Eng",
      location: "Remote",
      workMode: "remote",
      employmentType: "full_time",
      description: "Build things.",
      publishedAt: new Date("2026-01-01"),
    });
    const result = await resolvePublicJobBySlug("engineer");
    expect(result).not.toHaveProperty("status");
    expect(result).not.toHaveProperty("compensationMin");
    expect(result).not.toHaveProperty("ownerRecruiterUserId");
  });
});
