import { cache } from "react";
import type { SessionUser } from "@/lib/session";
import { createEmployeeConversionService } from "@/lib/recruitment/services/employee-conversion-service";

export const previewConversionCached = cache(async (session: SessionUser, offerId: string) => {
  const service = createEmployeeConversionService();
  return service.previewConversion(session, offerId);
});

export const listPendingConversionsCached = cache(async (session: SessionUser) => {
  const service = createEmployeeConversionService();
  return service.listPendingConversions(session);
});

export const listConversionHistoryCached = cache(async (session: SessionUser) => {
  const service = createEmployeeConversionService();
  return service.listConversionHistory(session);
});

export const getConversionDashboardMetricsCached = cache(async (session: SessionUser) => {
  const service = createEmployeeConversionService();
  return service.getConversionDashboardMetrics(session);
});
