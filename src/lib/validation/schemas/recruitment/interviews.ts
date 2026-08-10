import { z } from "zod";
import { InterviewRoundType, InterviewStatus } from "@/generated/prisma/enums";

export const createInterviewSchema = z.object({
  applicationId: z.string().trim().min(1, "Application ID is required."),
  roundType: z.nativeEnum(InterviewRoundType),
  status: z.nativeEnum(InterviewStatus).optional().default(InterviewStatus.scheduled),
  title: z.string().trim().min(1, "Title is required."),
  scheduledStart: z.string().trim().min(1, "Scheduled start time is required."),
  scheduledEnd: z.string().trim().min(1, "Scheduled end time is required."),
  timezone: z.string().trim().optional().default("UTC"),
  location: z.string().trim().optional(),
  meetingUrl: z.string().trim().optional(),
  summary: z.string().trim().optional(),
  panelistEmployeeIds: z.array(z.number().int().positive()).optional().default([]),
});

export const updateInterviewSchema = createInterviewSchema.partial().extend({
  id: z.string().trim().min(1, "Interview ID is required."),
});

export const interviewIdSchema = z.object({
  id: z.string().trim().min(1, "Interview ID is required."),
});

export const submitFeedbackSchema = z.object({
  interviewId: z.string().trim().min(1, "Interview ID is required."),
  overallRating: z.number().min(1).max(5, "Rating must be between 1 and 5."),
  recommendation: z.enum(["strong_hire", "hire", "lean_hire", "no_hire", "strong_no_hire"]),
  strengths: z.string().trim().min(1, "Strengths are required."),
  concerns: z.string().trim().optional(),
  privateNotes: z.string().trim().optional(),
  // Criterion id (string) → numeric rating. Zod 4 requires explicit key schema.
  ratingsJson: z.record(z.string(), z.number()).optional().default({}),
});
