import { z } from "zod";
import {
  CandidateStatus,
  CandidateSource,
  NoteVisibility,
  PreferredWorkMode,
} from "@/generated/prisma/enums";

const optionalTrimmed = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

const emailSchema = z
  .string()
  .trim()
  .email("Invalid email format.")
  .or(z.literal("").transform(() => null))
  .nullable()
  .optional();

const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format.")
  .or(z.literal("").transform(() => null))
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

const experienceYearsString = z
  .union([
    z
      .string()
      .trim()
      .regex(/^\d+(\.\d{1})?$/, "Enter years with at most 1 decimal place."),
    z.literal("").transform(() => null),
    z.null(),
  ])
  .optional();

/** Idempotent: FormData strings, already-parsed Date/null from action→service re-parse. */
const dateSchema = z.preprocess((value) => {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return value;
}, z.date().nullable().optional());

const optionalBoolean = z.preprocess((value) => {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (value === true || value === "true" || value === "1" || value === "on" || value === "yes") {
    return true;
  }
  if (value === false || value === "false" || value === "0" || value === "no") {
    return false;
  }
  return value;
}, z.boolean().nullable().optional());

const preferredWorkModeSchema = z.preprocess((value) => {
  if (value === undefined) return undefined;
  if (value === null || value === "" || value === "all") return null;
  return value;
}, z.nativeEnum(PreferredWorkMode).nullable().optional());

export const createCandidateSchema = z.object({
  tenantId: optionalTrimmed,
  fullName: z.string().trim().min(2, "Full name is required (at least 2 characters).").max(200),
  firstName: optionalTrimmed,
  lastName: optionalTrimmed,
  preferredName: optionalTrimmed,
  email: emailSchema,
  phone: phoneSchema,
  alternatePhone: phoneSchema,
  dateOfBirth: dateSchema,
  location: optionalTrimmed,
  preferredLocation: optionalTrimmed,
  /** Form convenience — mapped to CandidatePersonal.nationality in service */
  nationality: optionalTrimmed,
  currentCompany: optionalTrimmed,
  currentTitle: optionalTrimmed,
  linkedinUrl: optionalTrimmed,
  githubUrl: optionalTrimmed,
  portfolioUrl: optionalTrimmed,
  professionalSummary: optionalTrimmed,
  headline: optionalTrimmed,
  totalExperienceYears: experienceYearsString,
  preferredWorkMode: preferredWorkModeSchema,
  willingToRelocate: optionalBoolean,
  source: z.nativeEnum(CandidateSource).optional().default(CandidateSource.manual_upload),
  status: z.nativeEnum(CandidateStatus).optional().default(CandidateStatus.active),
  doNotHireReason: optionalTrimmed,
  currentCtc: moneyString,
  expectedCtc: moneyString,
  currency: z.string().trim().length(3, "Currency must be a 3-letter code.").optional().default("INR"),
  noticePeriodDays: z.coerce.number().int().nonnegative().nullable().optional(),
  earliestJoinDate: dateSchema,
  availabilityNotes: optionalTrimmed,
  timezone: optionalTrimmed,
  primaryRecruiterUserId: optionalTrimmed,
  referredByEmployeeId: z.coerce.number().int().positive().nullable().optional(),
});

export const updateCandidateSchema = createCandidateSchema
  .partial()
  .extend({
    id: z.string().trim().min(1),
    fullName: z.string().trim().min(2, "Full name must be at least 2 characters.").max(200).optional(),
  });

export const candidateIdSchema = z.object({
  id: z.string().trim().min(1),
});

export const mergeCandidateSchema = z.object({
  sourceId: z.string().trim().min(1, "Source candidate ID is required."),
  targetId: z.string().trim().min(1, "Target candidate ID is required."),
});

export const candidateListFiltersSchema = z.object({
  q: z.string().optional(),
  status: z.nativeEnum(CandidateStatus).or(z.literal("all")).optional(),
  source: z.nativeEnum(CandidateSource).or(z.literal("all")).optional(),
  includeArchived: z.boolean().optional(),
  createdBy: z.string().optional(),
  primaryRecruiter: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().optional().default(10),
  sort: z.enum(["createdAt", "fullName", "status", "updatedAt"]).optional().default("createdAt"),
  direction: z.enum(["asc", "desc"]).optional().default("desc"),
});

export const candidateSearchSchema = z.object({
  query: z.string().trim().min(1, "Search query is required."),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().optional().default(10),
});

export const addCandidateNoteSchema = z.object({
  candidateId: z.string().trim().min(1, "Candidate ID is required."),
  body: z
    .string()
    .trim()
    .min(1, "Note body is required.")
    .max(5000, "Note must be 5000 characters or fewer."),
  visibility: z.nativeEnum(NoteVisibility).optional().default(NoteVisibility.team),
});

export type AddCandidateNoteInput = z.input<typeof addCandidateNoteSchema>;
export type CreateCandidateInput = z.infer<typeof createCandidateSchema>;
export type UpdateCandidateInput = z.infer<typeof updateCandidateSchema>;
