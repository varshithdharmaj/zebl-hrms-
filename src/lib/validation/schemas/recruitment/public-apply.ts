import { z } from "zod";

const requiredEmail = z.string().trim().min(1, "Email is required.").email("Invalid email format.");
const requiredPhone = z
  .string()
  .trim()
  .min(1, "Phone is required.")
  .regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format.");

export const startPublicSubmissionSchema = z.object({
  jobPublicSlug: z.string().trim().min(1).max(160),
});

export const publicBasicInfoSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required.").max(200),
  email: requiredEmail,
  phone: requiredPhone,
});

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
  role: z.string().trim().max(200).nullable().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
});

const certificationRowSchema = z.object({
  name: z.string().trim().min(1).max(300),
  issuer: z.string().trim().max(200).nullable().optional(),
  issuedAt: z.string().trim().max(40).nullable().optional(),
  credentialUrl: z.string().trim().max(500).nullable().optional(),
  credentialId: z.string().trim().max(200).nullable().optional(),
});

/** Candidate-editable review payload — same field shapes as the internal
 * new-candidate-from-resume review schema (kept in sync deliberately; the
 * two forms shape the same target data). No fieldConfidence, no HR-only keys. */
export const publicReviewPayloadSchema = z.object({
  personal: z.object({
    fullName: z.string().trim().min(2).max(200),
    firstName: z.string().trim().max(100).nullable().optional(),
    lastName: z.string().trim().max(100).nullable().optional(),
    email: requiredEmail,
    phone: requiredPhone,
    location: z.string().trim().max(200).nullable().optional(),
  }),
  professional: z.object({
    headline: z.string().trim().max(200).nullable().optional(),
    professionalSummary: z.string().trim().max(4000).nullable().optional(),
    currentCompany: z.string().trim().max(200).nullable().optional(),
    currentTitle: z.string().trim().max(200).nullable().optional(),
    githubUrl: z.string().trim().max(500).nullable().optional(),
    linkedinUrl: z.string().trim().max(500).nullable().optional(),
    portfolioUrl: z.string().trim().max(500).nullable().optional(),
    totalExperienceYears: z.string().trim().max(10).nullable().optional(),
    preferredWorkMode: z.enum(["remote", "hybrid", "onsite"]).nullable().optional(),
    willingToRelocate: z.boolean().nullable().optional(),
  }),
  experiences: z.array(experienceRowSchema).max(40).default([]),
  educations: z.array(educationRowSchema).max(20).default([]),
  skills: z.array(skillRowSchema).max(80).default([]),
  projects: z.array(projectRowSchema).max(30).default([]),
  certifications: z.array(certificationRowSchema).max(30).default([]),
});

export const publicSubmitSchema = z.object({
  consent: z.literal(true, { message: "Please acknowledge the privacy notice to submit." }),
});

export type PublicBasicInfoInput = z.infer<typeof publicBasicInfoSchema>;
export type PublicReviewPayloadInput = z.infer<typeof publicReviewPayloadSchema>;
