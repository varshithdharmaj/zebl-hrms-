import { describe, it, expect, vi, beforeEach } from "vitest";
import { createAnalyticsService } from "@/lib/recruitment/services/analytics-service";
import type { AnalyticsRepository } from "@/lib/recruitment/repositories/analytics-repository";
import type { SessionUser } from "@/lib/session";
import { RecruitmentPermissionService } from "@/lib/recruitment/permissions/permission-service";
import { RecruitmentScopeEngine } from "@/lib/recruitment/permissions/recruitment-scope-engine";

vi.mock("@/lib/recruitment/permissions/permission-service");
vi.mock("@/lib/recruitment/permissions/recruitment-scope-engine");

describe("AnalyticsService", () => {
  let mockRepository: AnalyticsRepository;
  let session: SessionUser;

  beforeEach(() => {
    vi.clearAllMocks();

    session = {
      userId: "user-1",
      tenantId: "tenant-1",
      role: "hr",
      email: "hr@test.com",
      fullName: "HR User",
    };

    const mockScope = {
      candidateIds: new Set(["cand-1", "cand-2"]),
      applicationIds: new Set(["app-1", "app-2"]),
      jobOpeningIds: new Set(["job-1", "job-2"]),
      interviewIds: new Set(["int-1", "int-2"]),
    };

    vi.mocked(RecruitmentScopeEngine.getScope).mockResolvedValue(mockScope);
    vi.mocked(RecruitmentPermissionService.requireModuleEnabled).mockReturnValue(undefined);
    vi.mocked(RecruitmentPermissionService.requireHrAdministration).mockReturnValue(undefined);

    mockRepository = {
      getExecutiveKPIs: vi.fn().mockResolvedValue({
        totalOpenJobs: 10,
        activeCandidates: 50,
        totalApplications: 120,
        totalInterviews: 80,
        offersSent: 30,
        offersAccepted: 20,
        pendingConversions: 5,
        employeesJoined: 15,
        avgTimeToHire: 30,
        offerAcceptanceRate: 67,
        conversionRate: 75,
      }),
      getHiringFunnel: vi.fn().mockResolvedValue({
        candidates: 100,
        applications: 80,
        interviews: 50,
        offers: 25,
        accepted: 20,
        employees: 15,
      }),
      getPipelineMetrics: vi.fn().mockResolvedValue({
        byStage: [
          { stage: "screening", count: 20, avgDays: 5 },
          { stage: "interview", count: 15, avgDays: 10 },
        ],
        stuckCandidates: 3,
      }),
      getRecruiterPerformance: vi.fn().mockResolvedValue([
        {
          recruiterId: "rec-1",
          recruiterEmail: "recruiter@test.com",
          openJobs: 5,
          candidates: 20,
          interviews: 15,
          offers: 10,
          hires: 8,
          acceptanceRate: 80,
          avgTimeToHire: 25,
        },
      ]),
      getDepartmentAnalytics: vi.fn().mockResolvedValue([
        {
          department: "Engineering",
          openPositions: 5,
          filledPositions: 3,
          offers: 8,
          acceptanceRate: 75,
        },
      ]),
      getInterviewAnalytics: vi.fn().mockResolvedValue({
        upcoming: 10,
        completed: 50,
        cancelled: 5,
        noShow: 2,
        avgFeedbackScore: 4.2,
      }),
      getOfferAnalytics: vi.fn().mockResolvedValue({
        sent: 30,
        accepted: 20,
        declined: 5,
        expired: 3,
        withdrawn: 2,
        avgRevisionCount: 1.5,
      }),
      getSourceAnalytics: vi.fn().mockResolvedValue([
        {
          source: "linkedin",
          applications: 50,
          interviews: 30,
          offers: 15,
          hires: 10,
          conversionRate: 20,
        },
      ]),
      getTimeMetrics: vi.fn().mockResolvedValue({
        applicationToInterview: 7,
        interviewToOffer: 5,
        offerToHire: 14,
        totalTimeToHire: 26,
        sampleSize: 10,
      }),
      getTrendData: vi.fn().mockResolvedValue({
        dates: ["2024-01-01", "2024-01-02"],
        applications: [10, 15],
        interviews: [5, 8],
        offers: [2, 3],
        hires: [1, 2],
      }),
    };
  });

  describe("getExecutiveKPIs", () => {
    it("should fetch executive KPIs with scope", async () => {
      const service = createAnalyticsService(mockRepository);
      const result = await service.getExecutiveKPIs(session);

      expect(RecruitmentPermissionService.requireModuleEnabled).toHaveBeenCalled();
      expect(RecruitmentScopeEngine.getScope).toHaveBeenCalledWith(session);
      expect(mockRepository.getExecutiveKPIs).toHaveBeenCalled();
      expect(result.totalOpenJobs).toBe(10);
      expect(result.avgTimeToHire).toBe(30);
    });

    it("should pass filters to repository", async () => {
      const service = createAnalyticsService(mockRepository);
      const filters = {
        dateRange: {
          startDate: new Date("2024-01-01"),
          endDate: new Date("2024-12-31"),
        },
        department: "Engineering",
      };

      await service.getExecutiveKPIs(session, filters);

      const call = vi.mocked(mockRepository.getExecutiveKPIs).mock.calls[0][0];
      expect(call).toMatchObject(filters);
      expect(call.scope).toBeDefined();
    });
  });

  describe("getHiringFunnel", () => {
    it("should fetch hiring funnel data", async () => {
      const service = createAnalyticsService(mockRepository);
      const result = await service.getHiringFunnel(session);

      expect(mockRepository.getHiringFunnel).toHaveBeenCalled();
      expect(result.candidates).toBe(100);
      expect(result.employees).toBe(15);
    });
  });

  describe("getPipelineMetrics", () => {
    it("should fetch pipeline metrics", async () => {
      const service = createAnalyticsService(mockRepository);
      const result = await service.getPipelineMetrics(session);

      expect(mockRepository.getPipelineMetrics).toHaveBeenCalled();
      expect(result.byStage).toHaveLength(2);
      expect(result.stuckCandidates).toBe(3);
    });
  });

  describe("getRecruiterPerformance", () => {
    it("should require HR administration permission", async () => {
      const service = createAnalyticsService(mockRepository);
      await service.getRecruiterPerformance(session);

      expect(RecruitmentPermissionService.requireHrAdministration).toHaveBeenCalledWith(session);
    });

    it("should fetch recruiter performance data", async () => {
      const service = createAnalyticsService(mockRepository);
      const result = await service.getRecruiterPerformance(session);

      expect(mockRepository.getRecruiterPerformance).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].hires).toBe(8);
    });
  });

  describe("getDepartmentAnalytics", () => {
    it("should fetch department analytics", async () => {
      const service = createAnalyticsService(mockRepository);
      const result = await service.getDepartmentAnalytics(session);

      expect(mockRepository.getDepartmentAnalytics).toHaveBeenCalled();
      expect(result[0].department).toBe("Engineering");
    });
  });

  describe("getInterviewAnalytics", () => {
    it("should fetch interview analytics", async () => {
      const service = createAnalyticsService(mockRepository);
      const result = await service.getInterviewAnalytics(session);

      expect(mockRepository.getInterviewAnalytics).toHaveBeenCalled();
      expect(result.upcoming).toBe(10);
      expect(result.avgFeedbackScore).toBe(4.2);
    });
  });

  describe("getOfferAnalytics", () => {
    it("should fetch offer analytics", async () => {
      const service = createAnalyticsService(mockRepository);
      const result = await service.getOfferAnalytics(session);

      expect(mockRepository.getOfferAnalytics).toHaveBeenCalled();
      expect(result.sent).toBe(30);
      expect(result.accepted).toBe(20);
    });
  });

  describe("getSourceAnalytics", () => {
    it("should fetch source analytics", async () => {
      const service = createAnalyticsService(mockRepository);
      const result = await service.getSourceAnalytics(session);

      expect(mockRepository.getSourceAnalytics).toHaveBeenCalled();
      expect(result[0].source).toBe("linkedin");
      expect(result[0].conversionRate).toBe(20);
    });
  });

  describe("getTimeMetrics", () => {
    it("should fetch time metrics", async () => {
      const service = createAnalyticsService(mockRepository);
      const result = await service.getTimeMetrics(session);

      expect(mockRepository.getTimeMetrics).toHaveBeenCalled();
      expect(result.totalTimeToHire).toBe(26);
    });
  });

  describe("getTrendData", () => {
    it("should fetch trend data with days filter", async () => {
      const service = createAnalyticsService(mockRepository);
      const result = await service.getTrendData(session, { days: 30 });

      expect(mockRepository.getTrendData).toHaveBeenCalled();
      expect(result.dates).toHaveLength(2);
      expect(result.hires).toEqual([1, 2]);
    });
  });
});
