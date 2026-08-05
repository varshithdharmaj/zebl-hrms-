import { cache } from "react";
import type { SessionUser } from "@/lib/session";
import { createAnalyticsService } from "@/lib/recruitment/services/analytics-service";
import type { CachedAnalyticsFilters } from "./query-filters";

export const getExecutiveKPIsCached = cache(
  async (session: SessionUser, filters?: CachedAnalyticsFilters) => {
    const service = createAnalyticsService();
    return service.getExecutiveKPIs(session, filters);
  }
);

export const getHiringFunnelCached = cache(
  async (session: SessionUser, filters?: CachedAnalyticsFilters) => {
    const service = createAnalyticsService();
    return service.getHiringFunnel(session, filters);
  }
);

export const getPipelineMetricsCached = cache(
  async (session: SessionUser, filters?: CachedAnalyticsFilters) => {
    const service = createAnalyticsService();
    return service.getPipelineMetrics(session, filters);
  }
);

export const getRecruiterPerformanceCached = cache(
  async (session: SessionUser, filters?: CachedAnalyticsFilters) => {
    const service = createAnalyticsService();
    return service.getRecruiterPerformance(session, filters);
  }
);

export const getDepartmentAnalyticsCached = cache(
  async (session: SessionUser, filters?: CachedAnalyticsFilters) => {
    const service = createAnalyticsService();
    return service.getDepartmentAnalytics(session, filters);
  }
);

export const getInterviewAnalyticsCached = cache(
  async (session: SessionUser, filters?: CachedAnalyticsFilters) => {
    const service = createAnalyticsService();
    return service.getInterviewAnalytics(session, filters);
  }
);

export const getOfferAnalyticsCached = cache(
  async (session: SessionUser, filters?: CachedAnalyticsFilters) => {
    const service = createAnalyticsService();
    return service.getOfferAnalytics(session, filters);
  }
);

export const getSourceAnalyticsCached = cache(
  async (session: SessionUser, filters?: CachedAnalyticsFilters) => {
    const service = createAnalyticsService();
    return service.getSourceAnalytics(session, filters);
  }
);

export const getTimeMetricsCached = cache(
  async (session: SessionUser, filters?: CachedAnalyticsFilters) => {
    const service = createAnalyticsService();
    return service.getTimeMetrics(session, filters);
  }
);

export const getTrendDataCached = cache(
  async (
    session: SessionUser,
    filters: CachedAnalyticsFilters & { days: number }
  ) => {
    const service = createAnalyticsService();
    return service.getTrendData(session, filters);
  }
);
