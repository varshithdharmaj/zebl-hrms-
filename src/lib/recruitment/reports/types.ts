import type { AnalyticsDateFilter } from "@/lib/recruitment/repositories/analytics-repository";

export type ReportSectionKey =
  | "hiring"
  | "interviews"
  | "offers"
  | "conversions"
  | "communications";

export type ReportExportFormat = "csv" | "xlsx" | "pdf" | "print";

export type RecruitmentReportFilters = {
  dateRange?: AnalyticsDateFilter;
  department?: string;
  recruiterUserId?: string;
  jobOpeningId?: string;
  location?: string;
  employmentType?: string;
  status?: string;
  search?: string;
  days?: number;
};

export type ReportTableColumn = {
  key: string;
  label: string;
};

export type ReportTableRow = Record<string, string | number | null | undefined>;

export type ReportTable = {
  id: string;
  title: string;
  columns: ReportTableColumn[];
  rows: ReportTableRow[];
};

export type ReportChartSeries = {
  label: string;
  values: number[];
  color?: string;
};

export type ReportChart =
  | {
      id: string;
      title: string;
      kind: "bar" | "line" | "pie" | "stacked";
      labels: string[];
      series: ReportChartSeries[];
    };

export type ReportBundle = {
  section: ReportSectionKey;
  title: string;
  description: string;
  generatedAt: string;
  filters: RecruitmentReportFilters;
  kpis: Array<{ label: string; value: string | number }>;
  charts: ReportChart[];
  tables: ReportTable[];
};

export type SavedReportPreset = {
  id: string;
  name: string;
  section: ReportSectionKey;
  filters: RecruitmentReportFilters;
  isDefault: boolean;
};
