import { z } from "zod";
import { OfferStatus } from "@/generated/prisma/enums";

export const createOfferSchema = z.object({
  applicationId: z.string().trim().min(1, "Application ID is required."),
  hiringDecisionId: z.string().trim().optional().nullable(),
  currency: z.string().trim().default("INR"),
  baseSalary: z.coerce.number().positive("Base salary must be positive."),
  variablePay: z.coerce.number().nonnegative("Variable pay must be non-negative.").optional().nullable(),
  benefitsNotes: z.string().trim().optional().nullable(),
  proposedStartDate: z.string().trim().optional().nullable(),
  expiresAt: z.string().trim().optional().nullable(),
  offerNumber: z.string().trim().optional().nullable(),
  employmentType: z.string().trim().min(1, "Employment type is required."),
  department: z.string().trim().min(1, "Department is required."),
  location: z.string().trim().min(1, "Location is required."),
  grade: z.string().trim().min(1, "Grade is required."),
  reportingManagerId: z.coerce.number().int().positive().optional().nullable(),
  joiningDate: z.string().trim().min(1, "Joining date is required."),
  ctc: z.coerce.number().positive("CTC must be positive."),
  salaryBreakdownJson: z.record(z.coerce.number()).optional().nullable(),
  bonus: z.coerce.number().nonnegative("Bonus must be non-negative.").optional().nullable(),
  stock: z.string().trim().optional().nullable(),
  probationDays: z.coerce.number().int().nonnegative().optional().nullable(),
  noticeBuyout: z.boolean().optional().default(false),
  offerPdfKey: z.string().trim().optional().nullable(),
  offerNotes: z.string().trim().optional().nullable(),
});

export const updateOfferSchema = createOfferSchema.partial().extend({
  id: z.string().trim().min(1, "Offer ID is required."),
});

export const offerIdSchema = z.object({
  id: z.string().trim().min(1, "Offer ID is required."),
});

export const sendOfferSchema = z.object({
  id: z.string().trim().min(1, "Offer ID is required."),
  expiresAt: z.string().trim().optional().nullable(),
});

export const acceptOfferSchema = z.object({
  id: z.string().trim().min(1, "Offer ID is required."),
  acceptedAt: z.string().trim().optional().nullable(),
});

export const declineOfferSchema = z.object({
  id: z.string().trim().min(1, "Offer ID is required."),
  declinedAt: z.string().trim().optional().nullable(),
  reason: z.string().trim().optional().nullable(),
});

export const withdrawOfferSchema = z.object({
  id: z.string().trim().min(1, "Offer ID is required."),
  reason: z.string().trim().optional().nullable(),
});

export const createOfferRevisionSchema = z.object({
  id: z.string().trim().min(1, "Offer ID is required."),
  changeNote: z.string().trim().min(1, "Change note is required."),
  patch: createOfferSchema.partial(),
});
