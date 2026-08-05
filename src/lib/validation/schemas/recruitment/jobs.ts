import { z } from "zod";
import {
  JobEmploymentType,
  JobOpeningStatus,
  HiringTeamRole,
} from "@/generated/prisma/enums";

const employmentTypeEnum = z.nativeEnum(JobEmploymentType);
const jobStatusEnum = z.nativeEnum(JobOpeningStatus);
const hiringTeamRoleEnum = z.nativeEnum(HiringTeamRole);

const optionalTrimmed = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

const moneyString = z
  .union([
    z
      .string()
      .trim()
      .regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount (up to 2 decimal places)."),
    z.literal("").transform(() => null),
    z.null(),
  ])
  .optional();

const workModeSchema = z
  .union([z.enum(["onsite", "hybrid", "remote"]), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v === "" || v == null ? null : v));

function refineCompensationBand(
  data: { compensationMin?: string | null; compensationMax?: string | null },
  ctx: z.RefinementCtx
) {
  if (
    data.compensationMin != null &&
    data.compensationMax != null &&
    Number(data.compensationMin) > Number(data.compensationMax)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Minimum compensation cannot exceed maximum.",
      path: ["compensationMax"],
    });
  }
}

const jobOpeningFieldsSchema = z.object({
  title: z.string().trim().min(2, "Title is required.").max(200),
  code: optionalTrimmed,
  department: optionalTrimmed,
  location: optionalTrimmed,
  workMode: workModeSchema,
  employmentType: employmentTypeEnum.default(JobEmploymentType.full_time),
  description: optionalTrimmed,
  requirements: optionalTrimmed,
  skills: optionalTrimmed,
  openingsCount: z.coerce.number().int().min(1, "At least one opening is required.").max(500),
  headcountApproved: z.coerce.boolean().optional().default(false),
  headcountRequestedByEmployeeId: z.coerce.number().int().positive().nullable().optional(),
  headcountUrgency: z.enum(["low", "medium", "high", "critical"]).nullable().optional(),
  compensationCurrency: z
    .union([
      z.string().trim().length(3, "Currency must be a 3-letter code."),
      z.literal("").transform(() => null),
      z.null(),
    ])
    .optional(),
  compensationMin: moneyString,
  compensationMax: moneyString,
  targetStartDate: z
    .string()
    .trim()
    .optional()
    .transform((v) => {
      if (!v) return null;
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? null : d;
    }),
  pipelineTemplateId: optionalTrimmed,
  ownerRecruiterUserId: optionalTrimmed,
  hiringManagerEmployeeId: z.coerce.number().int().positive().nullable().optional(),
  teamLeadEmployeeIds: z
    .union([z.array(z.coerce.number().int().positive()), z.coerce.number().int().positive()])
    .optional()
    .transform((v) => {
      if (v == null) return [] as number[];
      return Array.isArray(v) ? v : [v];
    }),
  recruiterEmployeeId: z.coerce.number().int().positive().nullable().optional(),
  notes: optionalTrimmed,
});

export const createJobOpeningSchema = jobOpeningFieldsSchema
  .extend({
    publish: z.coerce.boolean().optional().default(false),
  })
  .superRefine(refineCompensationBand);

export const updateJobOpeningSchema = jobOpeningFieldsSchema
  .partial()
  .extend({
    id: z.string().trim().min(1),
    title: z.string().trim().min(2).max(200).optional(),
    openingsCount: z.coerce.number().int().min(1).max(500).optional(),
  })
  .superRefine(refineCompensationBand);

export const archiveJobOpeningSchema = z.object({
  id: z.string().trim().min(1),
});

export const closeJobOpeningSchema = z.object({
  id: z.string().trim().min(1),
  reason: z.string().trim().min(2, "Closing reason is required.").max(1000),
});

export const reopenJobOpeningSchema = z.object({
  id: z.string().trim().min(1),
  toStatus: z.enum(["open", "draft"]).default("open"),
  reason: z.string().trim().max(1000).optional(),
});

export const changeJobStatusSchema = z.object({
  id: z.string().trim().min(1),
  toStatus: jobStatusEnum,
  reason: z.string().trim().max(1000).nullable().optional(),
});

export const jobOpeningIdSchema = z.object({
  id: z.string().trim().min(1),
});

export const jobOpeningListFiltersSchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.union([jobStatusEnum, z.literal("all")]).optional().default("all"),
  department: z.string().trim().max(120).optional(),
  ownerRecruiterUserId: z.string().trim().optional(),
  includeArchived: z.coerce.boolean().optional().default(false),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).optional().default(25),
  sort: z
    .enum(["createdAt", "title", "status", "updatedAt", "closedAt"])
    .optional()
    .default("createdAt"),
  direction: z.enum(["asc", "desc"]).optional().default("desc"),
});

export const hiringTeamMemberSchema = z.object({
  jobOpeningId: z.string().trim().min(1),
  employeeId: z.coerce.number().int().positive(),
  role: hiringTeamRoleEnum,
});

export const hiringTeamMemberIdSchema = z.object({
  memberId: z.string().trim().min(1),
  jobOpeningId: z.string().trim().min(1),
});

export type CreateJobOpeningInput = z.infer<typeof createJobOpeningSchema>;
export type UpdateJobOpeningInput = z.infer<typeof updateJobOpeningSchema>;
export type JobOpeningListFiltersInput = z.infer<typeof jobOpeningListFiltersSchema>;
