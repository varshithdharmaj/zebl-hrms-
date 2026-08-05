import { z } from "zod";

export const reportSectionSchema = z.enum([
  "hiring",
  "interviews",
  "offers",
  "conversions",
  "communications",
]);

export const recruitmentReportFiltersSchema = z.object({
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
  department: z.string().trim().optional(),
  recruiterUserId: z.string().trim().optional(),
  jobOpeningId: z.string().trim().optional(),
  location: z.string().trim().optional(),
  employmentType: z.string().trim().optional(),
  status: z.string().trim().optional(),
  search: z.string().trim().optional(),
  days: z.coerce.number().int().min(7).max(365).optional(),
});

export const saveReportPresetSchema = z.object({
  name: z.string().trim().min(1).max(100),
  section: reportSectionSchema,
  filters: recruitmentReportFiltersSchema,
  isDefault: z.boolean().optional().default(false),
});

export const deleteReportPresetSchema = z.object({
  id: z.string().trim().min(1),
});

export const exportReportSchema = z.object({
  section: reportSectionSchema,
  format: z.enum(["csv", "xlsx", "pdf", "print"]),
  filters: recruitmentReportFiltersSchema.optional().default({}),
  selectedRowIds: z.array(z.string()).optional(),
  tableId: z.string().trim().optional(),
});

export type RecruitmentReportFiltersInput = z.infer<
  typeof recruitmentReportFiltersSchema
>;
