import { beforeEach, describe, expect, it, vi } from "vitest";
import { OfferStatus, CandidateStatus, ApplicationStatus, RecruitmentPipelineStage } from "@/generated/prisma/enums";
import { createEmployeeConversionService } from "@/lib/recruitment/services/employee-conversion-service";
import type { ConversionRepository } from "@/lib/recruitment/repositories/conversion-repository";
import type { SessionUser } from "@/lib/session";
import { RecruitmentDomainError } from "@/lib/recruitment/shared/errors";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/recruitment/config/feature-flags", () => ({
  isRecruitmentModuleEnabled: () => true,
  isRecruitmentOffersEnabled: () => true,
  isRecruitmentConversionEnabled: () => true,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    offer: {
      findUnique: vi.fn(async () => ({
        id: "off-1",
        offerNumber: "OFFER-2026-1234",
        status: OfferStatus.accepted,
        ctc: 1200000,
        currency: "INR",
        joiningDate: "2026-09-01",
        department: "Engineering",
        location: "Bangalore",
        reportingManagerId: 10,
        employmentType: "Full-time",
        grade: "L1",
        application: {
          id: "app-1",
          candidate: {
            id: "cand-1",
            fullName: "John Doe",
            email: "john.doe@example.com",
            phone: "1234567890",
            status: CandidateStatus.active,
          },
          jobOpening: {
            id: "job-1",
            title: "Software Engineer",
            openingsCount: 2,
          },
        },
      })),
      count: vi.fn(async () => 0),
    },
    employeeConversionSnapshot: {
      findUnique: vi.fn(async () => null),
      count: vi.fn(async () => 0),
    },
    employee: {
      count: vi.fn(async () => 1), // Reporting manager exists
    },
  },
}));

vi.mock("@/lib/recruitment/shared/after-commit", () => ({
  createAfterCommitBuffer: () => {
    const events: unknown[] = [];
    return {
      push: (e: unknown) => events.push(e),
      publishAll: vi.fn(async () => undefined),
      get size() {
        return events.length;
      },
    };
  },
}));

vi.mock("@/lib/recruitment/shared/transaction", () => ({
  withRecruitmentTransaction: async <T>(work: (tx: any) => Promise<T>) => {
    return work({
      employee: {
        create: vi.fn(async () => ({ id: 101 })),
      },
    });
  },
}));

vi.mock("@/lib/recruitment/services/timeline-service", () => ({
  RecruitmentTimelineService: {
    append: vi.fn(async () => undefined),
  },
}));

vi.mock("@/lib/leave", () => ({
  initializeEmployeeLeaveBalances: vi.fn(async () => undefined),
}));

vi.mock("@/lib/admin/user-management", () => ({
  provisionEmployeeLogin: vi.fn(async () => ({ userId: "user-101" })),
}));

const hrSession: SessionUser = {
  id: "user-hr",
  email: "hr@example.com",
  role: "hr",
  employeeId: 1,
  employeeName: "HR User",
  sessionVersion: 1,
  authProvider: "local",
};

const managerSession: SessionUser = {
  id: "user-manager",
  email: "manager@example.com",
  role: "manager",
  employeeId: 2,
  employeeName: "Manager User",
  sessionVersion: 1,
  authProvider: "local",
};

describe("EmployeeConversionService", () => {
  let mockRepo: ConversionRepository;

  beforeEach(() => {
    mockRepo = {
      convert: vi.fn(async () => ({ id: "snap-1" })),
      employeeExists: vi.fn(async () => false),
      updateApplication: vi.fn(async () => undefined),
      updateCandidate: vi.fn(async () => undefined),
      updateOffer: vi.fn(async () => undefined),
      incrementJobFilled: vi.fn(async () => ({ filledCount: 1, targetCount: 2, isFilled: false })),
      insertSnapshot: vi.fn(async () => ({ id: "snap-1" })),
      findByApplicationId: vi.fn(async () => null),
      findByCandidateId: vi.fn(async () => null),
      findByEmployeeId: vi.fn(async () => null),
    };
  });

  it("previews conversion successfully", async () => {
    const service = createEmployeeConversionService(mockRepo);
    const preview = await service.previewConversion(hrSession, "off-1");

    expect(preview.candidate.fullName).toBe("John Doe");
    expect(preview.offer.status).toBe(OfferStatus.accepted);
    expect(preview.checklist.offerAccepted).toBe(true);
    expect(preview.blockingErrors).toHaveLength(0);
  });

  it("prevents conversion if offer is not accepted", async () => {
    const service = createEmployeeConversionService(mockRepo);
    
    // Temporarily mock non-accepted offer
    const spy = vi.spyOn(prisma.offer, "findUnique");
    spy.mockImplementationOnce(async () => ({
      id: "off-1",
      status: OfferStatus.draft,
      application: {
        candidate: { status: CandidateStatus.active, fullName: "John Doe" },
      },
    } as any));

    const preview = await service.previewConversion(hrSession, "off-1");
    expect(preview.checklist.offerAccepted).toBe(false);
    expect(preview.blockingErrors).toContain("Offer must be accepted before conversion.");
  });

  it("converts employee successfully", async () => {
    const service = createEmployeeConversionService(mockRepo);
    const result = await service.convertEmployee(hrSession, {
      offerId: "off-1",
      employeeCode: "EMP-1024",
      name: "John Doe",
      email: "john.doe@example.com",
      phone: "1234567890",
      department: "Engineering",
      designation: "Software Engineer",
      managerId: 10,
      employmentType: "Full-time",
      workLocation: "Bangalore",
      joiningDate: "2026-09-01",
      grade: "L1",
      ctc: 1200000,
      createLogin: true,
      password: "password123",
    });

    expect(result.employeeId).toBe(101);
    expect(mockRepo.convert).toHaveBeenCalled();
    expect(mockRepo.updateApplication).toHaveBeenCalledWith("app-1", ApplicationStatus.hired, RecruitmentPipelineStage.hired, expect.any(Object));
    expect(mockRepo.updateCandidate).toHaveBeenCalledWith("cand-1", CandidateStatus.hired, 101, expect.any(Object));
  });

  it("prevents duplicate conversion if snapshot already exists", async () => {
    const service = createEmployeeConversionService(mockRepo);
    
    const spy = vi.spyOn(prisma.employeeConversionSnapshot, "findUnique");
    spy.mockImplementationOnce(async () => ({ id: "snap-1" } as any));

    await expect(
      service.convertEmployee(hrSession, {
        offerId: "off-1",
        employeeCode: "EMP-1024",
        name: "John Doe",
        email: "john.doe@example.com",
        department: "Engineering",
        designation: "Software Engineer",
        employmentType: "Full-time",
        workLocation: "Bangalore",
        joiningDate: "2026-09-01",
        grade: "L1",
        ctc: 1200000,
      })
    ).rejects.toThrow(RecruitmentDomainError);
  });

  it("prevents conversion if manager role attempts it", async () => {
    const service = createEmployeeConversionService(mockRepo);
    await expect(
      service.convertEmployee(managerSession, {
        offerId: "off-1",
        employeeCode: "EMP-1024",
        name: "John Doe",
        email: "john.doe@example.com",
        department: "Engineering",
        designation: "Software Engineer",
        employmentType: "Full-time",
        workLocation: "Bangalore",
        joiningDate: "2026-09-01",
        grade: "L1",
        ctc: 1200000,
      })
    ).rejects.toThrow();
  });
});
