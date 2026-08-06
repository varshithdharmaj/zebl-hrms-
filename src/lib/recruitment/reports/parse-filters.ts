import type { RecruitmentReportFilters } from "./types";
import {
  recruitmentReportFiltersSchema,
  type RecruitmentReportFiltersInput,
} from "./filter-schema";
import { getLast7DaysRange } from "./default-date-range";

function parseDate(value: string | undefined): Date | undefined {
  if (!value?.trim()) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function toReportFilters(
  input: RecruitmentReportFiltersInput | Record<string, string | string[] | undefined>
): RecruitmentReportFilters {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    normalized[key] = Array.isArray(value) ? value[0] : value;
  }
  const parsed = recruitmentReportFiltersSchema.parse(normalized);
  const startDate = parseDate(parsed.startDate);
  const endDate = parseDate(parsed.endDate);
  const defaults = getLast7DaysRange();

  return {
    dateRange: {
      startDate: startDate ?? defaults.startDate,
      endDate: endDate ?? defaults.endDate,
    },
    department: parsed.department || undefined,
    recruiterUserId: parsed.recruiterUserId || undefined,
    jobOpeningId: parsed.jobOpeningId || undefined,
    location: parsed.location || undefined,
    employmentType: parsed.employmentType || undefined,
    status: parsed.status || undefined,
    search: parsed.search || undefined,
    days: parsed.days ?? 7,
  };
}

export function filtersToSearchParams(
  filters: RecruitmentReportFilters
): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.dateRange?.startDate) {
    params.set("startDate", filters.dateRange.startDate.toISOString().slice(0, 10));
  }
  if (filters.dateRange?.endDate) {
    params.set("endDate", filters.dateRange.endDate.toISOString().slice(0, 10));
  }
  if (filters.department) params.set("department", filters.department);
  if (filters.recruiterUserId) params.set("recruiterUserId", filters.recruiterUserId);
  if (filters.jobOpeningId) params.set("jobOpeningId", filters.jobOpeningId);
  if (filters.location) params.set("location", filters.location);
  if (filters.employmentType) params.set("employmentType", filters.employmentType);
  if (filters.status) params.set("status", filters.status);
  if (filters.search) params.set("search", filters.search);
  if (filters.days) params.set("days", String(filters.days));
  return params;
}

export function analyticsFilterFromReport(filters: RecruitmentReportFilters) {
  return {
    dateRange: filters.dateRange,
    department: filters.department,
    recruiterUserId: filters.recruiterUserId,
    jobOpeningId: filters.jobOpeningId,
    location: filters.location,
    employmentType: filters.employmentType,
    source: filters.status,
  };
}
