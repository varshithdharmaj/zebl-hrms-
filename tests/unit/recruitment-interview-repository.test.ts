import { describe, expect, it, vi, beforeEach } from "vitest";
import { InterviewStatus } from "@/generated/prisma/enums";

const findUnique = vi.fn();
const findMany = vi.fn();
const count = vi.fn();
const transaction = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    interview: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      findMany: (...args: unknown[]) => findMany(...args),
      count: (...args: unknown[]) => count(...args),
    },
    $transaction: (...args: unknown[]) => transaction(...args),
  },
}));

import { prismaInterviewRepository } from "@/lib/recruitment/repositories/prisma-interview-repository";
import { unrestrictedRecruitmentScope } from "@/lib/recruitment/types/scope";

const listRow = {
  id: "int-1",
  applicationId: "app-1",
  roundType: "technical",
  status: InterviewStatus.scheduled,
  title: "Technical Round",
  scheduledStart: new Date("2026-08-04T10:00:00Z"),
  scheduledEnd: new Date("2026-08-04T11:00:00Z"),
  timezone: null,
  location: "Zoom",
  meetingUrl: null,
  summary: null,
  createdByUserId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  application: {
    id: "app-1",
    candidateId: "cand-1",
    jobOpeningId: "job-1",
    candidate: {
      id: "cand-1",
      fullName: "Alex Candidate",
      email: "alex@example.com",
    },
    jobOpening: {
      id: "job-1",
      title: "Engineer",
      location: "Remote",
    },
  },
  panelists: [
    {
      id: "panel-1",
      employeeId: 2,
      employee: { id: 2, name: "Pat Panelist" },
    },
  ],
};

const detailRow = {
  ...listRow,
  application: {
    ...listRow.application,
    candidate: {
      id: "cand-1",
      fullName: "Alex Candidate",
      email: "alex@example.com",
      currentCtc: "100000",
      expectedCtc: "120000",
      totalExperienceYears: "5",
    },
    jobOpening: {
      id: "job-1",
      title: "Engineer",
      location: "Remote",
      compensationMin: "90000",
      compensationMax: "130000",
    },
  },
  panelists: [
    {
      id: "panel-1",
      employeeId: 2,
      employee: {
        id: 2,
        name: "Pat Panelist",
        user: { id: "user-2", email: "pat@example.com" },
      },
    },
  ],
  feedback: [
    {
      id: "fb-1",
      interviewId: "int-1",
      authorEmployeeId: 2,
      overallRating: 4,
      ratingsJson: {},
      recommendation: "hire",
      strengths: null,
      concerns: null,
      privateNotes: null,
      submittedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      author: {
        id: 2,
        name: "Pat Panelist",
        user: { id: "user-2", email: "pat@example.com" },
      },
    },
  ],
  attachments: [
    {
      id: "att-1",
      interviewId: "int-1",
      fileName: "notes.pdf",
      mimeType: "application/pdf",
      sizeBytes: 100,
      storageKey: "key",
      uploadedByUserId: null,
      createdAt: new Date(),
      deletedAt: null,
    },
  ],
};

describe("prismaInterviewRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transaction.mockImplementation(async (ops: Promise<unknown>[]) => Promise.all(ops));
    count.mockResolvedValue(1);
    findMany.mockResolvedValue([listRow]);
    findUnique.mockResolvedValue(detailRow);
  });

  it("listInterviews uses lean include without feedback or attachments", async () => {
    const page = await prismaInterviewRepository.listInterviews({
      scope: unrestrictedRecruitmentScope(),
      pagination: { page: 1, pageSize: 25 },
      sort: { field: "scheduledStart", direction: "asc" },
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          application: expect.objectContaining({
            select: expect.objectContaining({
              candidate: expect.objectContaining({ select: expect.any(Object) }),
              jobOpening: expect.objectContaining({ select: expect.any(Object) }),
            }),
          }),
          panelists: expect.any(Object),
        }),
      })
    );
    const includeArg = findMany.mock.calls[0]?.[0]?.include as Record<string, unknown>;
    expect(includeArg).not.toHaveProperty("feedback");
    expect(includeArg).not.toHaveProperty("attachments");

    expect(page.items[0]).toMatchObject({
      id: "int-1",
      feedback: [],
      attachments: [],
      application: {
        candidate: { fullName: "Alex Candidate" },
        jobOpening: { title: "Engineer" },
      },
      panelists: [{ employee: { name: "Pat Panelist" } }],
    });
  });

  it("listInterviews applies scheduledStart range filters", async () => {
    const from = new Date(2026, 7, 1);
    const to = new Date(2026, 7, 31, 23, 59, 59, 999);

    await prismaInterviewRepository.listInterviews({
      scope: unrestrictedRecruitmentScope(),
      filters: { scheduledStartFrom: from, scheduledStartTo: to },
      pagination: { page: 1, pageSize: 25 },
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            {},
            expect.objectContaining({
              scheduledStart: { gte: from, lte: to },
            }),
          ],
        },
      })
    );
  });

  it("listInterviews preserves status filter and pagination", async () => {
    await prismaInterviewRepository.listInterviews({
      scope: unrestrictedRecruitmentScope(),
      filters: { status: InterviewStatus.completed },
      pagination: { page: 2, pageSize: 10 },
      sort: { field: "scheduledStart", direction: "desc" },
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
        orderBy: { scheduledStart: "desc" },
        where: {
          AND: [
            {},
            expect.objectContaining({ status: InterviewStatus.completed }),
          ],
        },
      })
    );
  });

  it("getInterview keeps detail include with feedback and attachments", async () => {
    const interview = await prismaInterviewRepository.getInterview("int-1");

    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          feedback: expect.any(Object),
          attachments: expect.any(Object),
          application: expect.objectContaining({
            include: expect.objectContaining({
              candidate: true,
              jobOpening: true,
            }),
          }),
        }),
      })
    );
    expect(interview?.feedback).toHaveLength(1);
    expect(interview?.attachments).toHaveLength(1);
    expect(interview?.application?.candidate?.currentCtc).toBe(100000);
  });
});
