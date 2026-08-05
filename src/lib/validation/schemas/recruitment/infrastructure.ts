import { z } from "zod";
import { RECRUITMENT_EVENT_TYPES } from "@/lib/recruitment/types/events";

/** Infrastructure Zod schemas only — no feature-specific job/candidate forms yet. */

export const recruitmentPaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(25),
});

export const recruitmentCursorPaginationSchema = z.object({
  cursor: z.string().trim().min(1).nullable().optional().default(null),
  limit: z.coerce.number().int().min(1).max(50).default(25),
});

export const recruitmentSortSchema = z.object({
  field: z.string().trim().min(1).max(64),
  direction: z.enum(["asc", "desc"]).default("desc"),
});

export const recruitmentSearchFiltersSchema = z
  .object({
    q: z.string().trim().max(200).optional(),
    status: z.string().trim().max(64).optional(),
  })
  .passthrough();

export const recruitmentActorSchema = z.object({
  userId: z.string().trim().min(1),
  email: z.string().email(),
  role: z.enum(["super_admin", "hr", "employee"]),
  employeeId: z.number().int().positive().nullable(),
});

export const recruitmentIdSchema = z.string().trim().min(1).max(64);

export const recruitmentEventTypeSchema = z.enum(RECRUITMENT_EVENT_TYPES);

export const recruitmentTimelineEntityTypeSchema = z.enum([
  "job_opening",
  "candidate",
  "application",
  "interview",
  "offer",
  "intake",
]);

export const timelineAppendSchema = z.object({
  entityType: recruitmentTimelineEntityTypeSchema,
  entityId: recruitmentIdSchema,
  eventType: z.string().trim().min(1).max(128),
  summary: z.string().trim().min(1).max(500),
  actorUserId: z.string().trim().min(1).nullable().optional(),
  applicationId: recruitmentIdSchema.nullable().optional(),
  candidateId: recruitmentIdSchema.nullable().optional(),
  jobOpeningId: recruitmentIdSchema.nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const timelineListFilterSchema = z.object({
  entityType: recruitmentTimelineEntityTypeSchema.optional(),
  entityId: recruitmentIdSchema.optional(),
  applicationId: recruitmentIdSchema.optional(),
  candidateId: recruitmentIdSchema.optional(),
  jobOpeningId: recruitmentIdSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});
