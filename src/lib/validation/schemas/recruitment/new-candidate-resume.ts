import { z } from "zod";
import { createCandidateSchema } from "@/lib/validation/schemas/recruitment/candidates";

const experienceRowSchema = z.object({
  company: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(200),
  location: z.string().trim().max(200).nullable().optional(),
  startDate: z.string().trim().max(40).nullable().optional(),
  endDate: z.string().trim().max(40).nullable().optional(),
  isCurrent: z.boolean().optional(),
  description: z.string().trim().max(8000).nullable().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
});

const educationRowSchema = z.object({
  institution: z.string().trim().min(1).max(300),
  degree: z.string().trim().max(200).nullable().optional(),
  field: z.string().trim().max(200).nullable().optional(),
  startYear: z.number().int().min(1950).max(2100).nullable().optional(),
  endYear: z.number().int().min(1950).max(2100).nullable().optional(),
  grade: z.string().trim().max(80).nullable().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
});

const skillRowSchema = z.object({
  name: z.string().trim().min(1).max(80),
  proficiency: z.string().trim().max(80).nullable().optional(),
  yearsOfExperience: z.number().int().nonnegative().nullable().optional(),
});

const projectRowSchema = z.object({
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().max(8000).nullable().optional(),
  techStack: z.string().trim().max(500).nullable().optional(),
  url: z.string().trim().max(500).nullable().optional(),
  duration: z.string().trim().max(120).nullable().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
});

const certificationRowSchema = z.object({
  name: z.string().trim().min(1).max(300),
  issuer: z.string().trim().max(200).nullable().optional(),
  issuedAt: z.string().trim().max(40).nullable().optional(),
  credentialUrl: z.string().trim().max(500).nullable().optional(),
  credentialId: z.string().trim().max(200).nullable().optional(),
});

/** Recruiter-edited review payload confirmed after Parser V2 extraction. */
export const createCandidateFromResumeReviewSchema = z.object({
  intakeId: z.string().trim().min(1),
  candidate: createCandidateSchema
    .omit({
      currentCtc: true,
      expectedCtc: true,
      currency: true,
      noticePeriodDays: true,
      earliestJoinDate: true,
      availabilityNotes: true,
      doNotHireReason: true,
      preferredLocation: true,
      status: true,
      source: true,
    })
    .extend({
      // Keep optional create defaults out of resume flow for denied keys.
      fullName: z.string().trim().min(2).max(200),
    }),
  experiences: z.array(experienceRowSchema).max(40).default([]),
  educations: z.array(educationRowSchema).max(20).default([]),
  skills: z.array(skillRowSchema).max(80).default([]),
  projects: z.array(projectRowSchema).max(30).default([]),
  certifications: z.array(certificationRowSchema).max(30).default([]),
});

export type CreateCandidateFromResumeReviewInput = z.infer<
  typeof createCandidateFromResumeReviewSchema
>;
