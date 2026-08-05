import type { AnalyticsDateFilter } from "@/lib/recruitment/repositories/analytics-repository";
import type { AnalyticsQueryFilters } from "@/lib/recruitment/services/analytics-service";

/** Shared filter shape accepted by all cached analytics query helpers. */
export type CachedAnalyticsFilters = {
  dateRange?: AnalyticsDateFilter;
  department?: string;
  recruiterUserId?: string;
  jobOpeningId?: string;
  location?: string;
  employmentType?: string;
  source?: string;
  days?: number;
};

export function toCachedAnalyticsFilters(
  filters?: CachedAnalyticsFilters
): AnalyticsQueryFilters {
  return filters ?? {};
}
