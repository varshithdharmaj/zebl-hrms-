import type { SessionUser } from "@/lib/session";
import { RecruitmentPermissionService } from "@/lib/recruitment/permissions/permission-service";
import { RecruitmentScopeEngine } from "@/lib/recruitment/permissions/recruitment-scope-engine";
import type {
  AnalyticsRepository,
  AnalyticsFilters,
} from "@/lib/recruitment/repositories/analytics-repository";
import { prismaAnalyticsRepository } from "@/lib/recruitment/repositories/analytics-repository";

export type AnalyticsQueryFilters = Omit<AnalyticsFilters, "scope"> & {
  days?: number;
};

export type AnalyticsService = {
  getExecutiveKPIs(
    session: SessionUser,
    filters?: AnalyticsQueryFilters
  ): Promise<ReturnType<AnalyticsRepository["getExecutiveKPIs"]>>;

  getHiringFunnel(
    session: SessionUser,
    filters?: AnalyticsQueryFilters
  ): Promise<ReturnType<AnalyticsRepository["getHiringFunnel"]>>;

  getPipelineMetrics(
    session: SessionUser,
    filters?: AnalyticsQueryFilters
  ): Promise<ReturnType<AnalyticsRepository["getPipelineMetrics"]>>;

  getRecruiterPerformance(
    session: SessionUser,
    filters?: AnalyticsQueryFilters
  ): Promise<ReturnType<AnalyticsRepository["getRecruiterPerformance"]>>;

  getDepartmentAnalytics(
    session: SessionUser,
    filters?: AnalyticsQueryFilters
  ): Promise<ReturnType<AnalyticsRepository["getDepartmentAnalytics"]>>;

  getInterviewAnalytics(
    session: SessionUser,
    filters?: AnalyticsQueryFilters
  ): Promise<ReturnType<AnalyticsRepository["getInterviewAnalytics"]>>;

  getOfferAnalytics(
    session: SessionUser,
    filters?: AnalyticsQueryFilters
  ): Promise<ReturnType<AnalyticsRepository["getOfferAnalytics"]>>;

  getSourceAnalytics(
    session: SessionUser,
    filters?: AnalyticsQueryFilters
  ): Promise<ReturnType<AnalyticsRepository["getSourceAnalytics"]>>;

  getTimeMetrics(
    session: SessionUser,
    filters?: AnalyticsQueryFilters
  ): Promise<ReturnType<AnalyticsRepository["getTimeMetrics"]>>;

  getTrendData(
    session: SessionUser,
    filters: AnalyticsQueryFilters & { days: number }
  ): Promise<ReturnType<AnalyticsRepository["getTrendData"]>>;
};

export function createAnalyticsService(
  repository: AnalyticsRepository = prismaAnalyticsRepository
): AnalyticsService {
  return {
    async getExecutiveKPIs(session, filters = {}) {
      RecruitmentPermissionService.requireModuleEnabled();
      const scope = await RecruitmentScopeEngine.getScope(session);

      const analyticsFilters: AnalyticsFilters = {
        ...filters,
        scope,
      };

      return repository.getExecutiveKPIs(analyticsFilters);
    },

    async getHiringFunnel(session, filters = {}) {
      RecruitmentPermissionService.requireModuleEnabled();
      const scope = await RecruitmentScopeEngine.getScope(session);

      const analyticsFilters: AnalyticsFilters = {
        ...filters,
        scope,
      };

      return repository.getHiringFunnel(analyticsFilters);
    },

    async getPipelineMetrics(session, filters = {}) {
      RecruitmentPermissionService.requireModuleEnabled();
      const scope = await RecruitmentScopeEngine.getScope(session);

      const analyticsFilters: AnalyticsFilters = {
        ...filters,
        scope,
      };

      return repository.getPipelineMetrics(analyticsFilters);
    },

    async getRecruiterPerformance(session, filters = {}) {
      RecruitmentPermissionService.requireModuleEnabled();
      RecruitmentPermissionService.requireHrAdministration(session);
      const scope = await RecruitmentScopeEngine.getScope(session);

      const analyticsFilters: AnalyticsFilters = {
        ...filters,
        scope,
      };

      return repository.getRecruiterPerformance(analyticsFilters);
    },

    async getDepartmentAnalytics(session, filters = {}) {
      RecruitmentPermissionService.requireModuleEnabled();
      const scope = await RecruitmentScopeEngine.getScope(session);

      const analyticsFilters: AnalyticsFilters = {
        ...filters,
        scope,
      };

      return repository.getDepartmentAnalytics(analyticsFilters);
    },

    async getInterviewAnalytics(session, filters = {}) {
      RecruitmentPermissionService.requireModuleEnabled();
      const scope = await RecruitmentScopeEngine.getScope(session);

      const analyticsFilters: AnalyticsFilters = {
        ...filters,
        scope,
      };

      return repository.getInterviewAnalytics(analyticsFilters);
    },

    async getOfferAnalytics(session, filters = {}) {
      RecruitmentPermissionService.requireModuleEnabled();
      const scope = await RecruitmentScopeEngine.getScope(session);

      const analyticsFilters: AnalyticsFilters = {
        ...filters,
        scope,
      };

      return repository.getOfferAnalytics(analyticsFilters);
    },

    async getSourceAnalytics(session, filters = {}) {
      RecruitmentPermissionService.requireModuleEnabled();
      const scope = await RecruitmentScopeEngine.getScope(session);

      const analyticsFilters: AnalyticsFilters = {
        ...filters,
        scope,
      };

      return repository.getSourceAnalytics(analyticsFilters);
    },

    async getTimeMetrics(session, filters = {}) {
      RecruitmentPermissionService.requireModuleEnabled();
      const scope = await RecruitmentScopeEngine.getScope(session);

      const analyticsFilters: AnalyticsFilters = {
        ...filters,
        scope,
      };

      return repository.getTimeMetrics(analyticsFilters);
    },

    async getTrendData(session, filters) {
      RecruitmentPermissionService.requireModuleEnabled();
      const scope = await RecruitmentScopeEngine.getScope(session);

      const analyticsFilters: AnalyticsFilters & { days: number } = {
        ...filters,
        scope,
      };

      return repository.getTrendData(analyticsFilters);
    },
  };
}
