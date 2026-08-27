import { beforeEach, describe, expect, it, vi } from "vitest";

function makeMockPrisma() {
  const publicApplicationSubmission = {
    findMany: vi.fn(),
    updateMany: vi.fn(),
  };
  return { publicApplicationSubmission };
}

vi.mock("@/lib/prisma", () => ({ prisma: makeMockPrisma() }));

import { prisma } from "@/lib/prisma";
import {
  createMemoryStorageAdapter,
  setRecruitmentStorageForTests,
} from "@/lib/recruitment/storage";
import {
  expireSubmission,
} from "@/lib/recruitment/public-apply/public-application-service";
import { runPublicApplyExpiryBatch } from "@/lib/recruitment/public-apply/expire-submissions-batch";

type MockRow = {
  id: string;
  status: string;
  resumeStorageKey: string | null;
  photoStorageKey: string | null;
};

function makeRow(overrides: Partial<MockRow> & { id: string }): MockRow {
  return {
    status: "resume_uploaded",
    resumeStorageKey: null,
    photoStorageKey: null,
    ...overrides,
  };
}

describe("expireSubmission", () => {
  let storage: ReturnType<typeof createMemoryStorageAdapter>;

  beforeEach(() => {
    storage = createMemoryStorageAdapter();
    setRecruitmentStorageForTests(storage);
    vi.mocked(prisma.publicApplicationSubmission.updateMany).mockReset();
    vi.mocked(prisma.publicApplicationSubmission.updateMany).mockResolvedValue({
      count: 1,
    } as never);
  });

  it("deletes the temp resume and clears the reference on expiry", async () => {
    const key = "public-intake/2026-08/sub-1/resume.pdf";
    await storage.save(key, Buffer.from("resume-bytes"));

    await expireSubmission(makeRow({ id: "sub-1", resumeStorageKey: key }) as never);

    expect(await storage.exists(key)).toBe(false);
    expect(prisma.publicApplicationSubmission.updateMany).toHaveBeenCalledWith({
      where: { id: "sub-1", status: { notIn: ["submitted", "job_closed", "expired"] } },
      data: { status: "expired", resumeStorageKey: null, photoStorageKey: null },
    });
  });

  it("deletes the temp photo and clears the reference on expiry", async () => {
    const key = "public-intake/2026-08/sub-2/photo-headshot.jpg";
    await storage.save(key, Buffer.from("photo-bytes"));

    await expireSubmission(makeRow({ id: "sub-2", photoStorageKey: key }) as never);

    expect(await storage.exists(key)).toBe(false);
    expect(prisma.publicApplicationSubmission.updateMany).toHaveBeenCalledTimes(1);
  });

  it("removes both temp files when a submission has resume and photo", async () => {
    const resumeKey = "public-intake/2026-08/sub-3/resume.pdf";
    const photoKey = "public-intake/2026-08/sub-3/photo-headshot.jpg";
    await storage.save(resumeKey, Buffer.from("resume-bytes"));
    await storage.save(photoKey, Buffer.from("photo-bytes"));

    await expireSubmission(
      makeRow({ id: "sub-3", resumeStorageKey: resumeKey, photoStorageKey: photoKey }) as never
    );

    expect(await storage.exists(resumeKey)).toBe(false);
    expect(await storage.exists(photoKey)).toBe(false);
  });

  it("is idempotent when the temp file is already gone", async () => {
    const key = "public-intake/2026-08/sub-4/resume.pdf";
    // Never saved — simulates a second run after the first already deleted it.
    await expect(
      expireSubmission(makeRow({ id: "sub-4", resumeStorageKey: key }) as never)
    ).resolves.toBeUndefined();
    expect(prisma.publicApplicationSubmission.updateMany).toHaveBeenCalledTimes(1);
  });

  it("never references CandidateDocument or any permanent-storage table", async () => {
    // prisma mock only defines publicApplicationSubmission — any accidental
    // touch of candidateDocument (or any other model) throws immediately.
    await expect(
      expireSubmission(makeRow({ id: "sub-5" }) as never)
    ).resolves.toBeUndefined();
  });
});

describe("runPublicApplyExpiryBatch", () => {
  let storage: ReturnType<typeof createMemoryStorageAdapter>;

  beforeEach(() => {
    storage = createMemoryStorageAdapter();
    setRecruitmentStorageForTests(storage);
    vi.mocked(prisma.publicApplicationSubmission.findMany).mockReset();
    vi.mocked(prisma.publicApplicationSubmission.updateMany).mockReset();
  });

  it("queries only non-terminal rows past their TTL, bounded by batch size", async () => {
    vi.mocked(prisma.publicApplicationSubmission.findMany).mockResolvedValue([] as never);
    const asOf = new Date("2026-08-27T00:00:00.000Z");

    await runPublicApplyExpiryBatch({ asOf, batchSize: 25 });

    expect(prisma.publicApplicationSubmission.findMany).toHaveBeenCalledWith({
      where: {
        expiresAt: { lt: asOf },
        status: { notIn: ["submitted", "job_closed", "expired"] },
      },
      orderBy: { expiresAt: "asc" },
      take: 25,
    });
  });

  it("expires every eligible row and reports scanned/expired/failed counts", async () => {
    const rows = [
      makeRow({ id: "a", resumeStorageKey: "public-intake/2026-08/a/resume.pdf" }),
      makeRow({ id: "b", photoStorageKey: "public-intake/2026-08/b/photo-x.jpg" }),
    ];
    await storage.save(rows[0].resumeStorageKey as string, Buffer.from("r"));
    await storage.save(rows[1].photoStorageKey as string, Buffer.from("p"));

    vi.mocked(prisma.publicApplicationSubmission.findMany).mockResolvedValue(rows as never);
    vi.mocked(prisma.publicApplicationSubmission.updateMany).mockResolvedValue({
      count: 1,
    } as never);

    const result = await runPublicApplyExpiryBatch();

    expect(result).toEqual({ scanned: 2, expired: 2, failed: 0 });
    expect(await storage.exists(rows[0].resumeStorageKey as string)).toBe(false);
    expect(await storage.exists(rows[1].photoStorageKey as string)).toBe(false);
  });

  it("does not process a row the query filter already excluded (not-expired / already-finalized)", async () => {
    // Simulates the DB-side filter already excluding a non-expired or
    // terminal (submitted/job_closed/expired) row — batch never sees it.
    vi.mocked(prisma.publicApplicationSubmission.findMany).mockResolvedValue([] as never);

    const result = await runPublicApplyExpiryBatch();

    expect(result).toEqual({ scanned: 0, expired: 0, failed: 0 });
    expect(prisma.publicApplicationSubmission.updateMany).not.toHaveBeenCalled();
  });

  it("continues processing remaining rows when one submission's expiry fails", async () => {
    const rows = [
      makeRow({ id: "ok-1", resumeStorageKey: "public-intake/2026-08/ok-1/resume.pdf" }),
      makeRow({ id: "bad", resumeStorageKey: "public-intake/2026-08/bad/resume.pdf" }),
      makeRow({ id: "ok-2", resumeStorageKey: "public-intake/2026-08/ok-2/resume.pdf" }),
    ];
    for (const row of rows) {
      await storage.save(row.resumeStorageKey as string, Buffer.from("bytes"));
    }

    vi.mocked(prisma.publicApplicationSubmission.findMany).mockResolvedValue(rows as never);
    vi.mocked(prisma.publicApplicationSubmission.updateMany).mockImplementation(
      (async (args: { where: { id: string } }) => {
        if (args.where.id === "bad") throw new Error("db unavailable");
        return { count: 1 };
      }) as never
    );

    const result = await runPublicApplyExpiryBatch();

    expect(result).toEqual({ scanned: 3, expired: 2, failed: 1 });
    // Best-effort blob cleanup still ran for the row whose DB update failed —
    // deletes happen before the throwing call, so cleanup isn't lost.
    expect(await storage.exists("public-intake/2026-08/bad/resume.pdf")).toBe(false);
    expect(await storage.exists("public-intake/2026-08/ok-1/resume.pdf")).toBe(false);
    expect(await storage.exists("public-intake/2026-08/ok-2/resume.pdf")).toBe(false);
  });

  it("respects the configured batch size", async () => {
    vi.mocked(prisma.publicApplicationSubmission.findMany).mockResolvedValue([] as never);

    await runPublicApplyExpiryBatch({ batchSize: 7 });

    expect(prisma.publicApplicationSubmission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 7 })
    );
  });
});
