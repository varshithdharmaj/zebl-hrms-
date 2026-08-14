/**
 * Zod schema for the structured LLM resume extraction response.
 *
 * Maps directly to the existing `ResumeImportMappedDraft` type so the
 * merge engine, review UI, and candidate creation flow work unchanged.
 *
 * Uses Zod v4 (already in package.json).
 */

import { z } from "zod";

export const llmExperienceSchema = z.object({
  company: z.string(),
  title: z.string(),
  location: z.string().nullable().optional().default(null),
  startDate: z.string().nullable().optional().default(null),
  endDate: z.string().nullable().optional().default(null),
  isCurrent: z.boolean().optional().default(false),
  description: z.string().nullable().optional().default(null),
});

export const llmEducationSchema = z.object({
  institution: z.string(),
  degree: z.string().nullable().optional().default(null),
  field: z.string().nullable().optional().default(null),
  startYear: z.number().int().nullable().optional().default(null),
  endYear: z.number().int().nullable().optional().default(null),
  grade: z.string().nullable().optional().default(null),
});

export const llmSkillSchema = z.object({
  name: z.string(),
  proficiency: z.string().nullable().optional().default(null),
  yearsOfExperience: z.number().nullable().optional().default(null),
});

export const llmProjectSchema = z.object({
  title: z.string(),
  summary: z.string().nullable().optional().default(null),
  techStack: z.string().nullable().optional().default(null),
  url: z.string().nullable().optional().default(null),
  role: z.string().nullable().optional().default(null),
  duration: z.string().nullable().optional().default(null),
});

export const llmCertificationSchema = z.object({
  name: z.string(),
  issuer: z.string().nullable().optional().default(null),
  issuedAt: z.string().nullable().optional().default(null),
  expiresAt: z.string().nullable().optional().default(null),
  credentialId: z.string().nullable().optional().default(null),
  credentialUrl: z.string().nullable().optional().default(null),
});

export const llmResumeResponseSchema = z.object({
  fullName: z.string().nullable().optional().default(null),
  firstName: z.string().nullable().optional().default(null),
  lastName: z.string().nullable().optional().default(null),
  email: z.string().nullable().optional().default(null),
  phone: z.string().nullable().optional().default(null),
  location: z.string().nullable().optional().default(null),
  headline: z.string().nullable().optional().default(null),
  professionalSummary: z.string().nullable().optional().default(null),
  currentCompany: z.string().nullable().optional().default(null),
  currentTitle: z.string().nullable().optional().default(null),
  totalExperienceYears: z.string().nullable().optional().default(null),
  linkedinUrl: z.string().nullable().optional().default(null),
  githubUrl: z.string().nullable().optional().default(null),
  portfolioUrl: z.string().nullable().optional().default(null),
  experiences: z.array(llmExperienceSchema).optional().default([]),
  educations: z.array(llmEducationSchema).optional().default([]),
  skills: z.array(llmSkillSchema).optional().default([]),
  projects: z.array(llmProjectSchema).optional().default([]),
  certifications: z.array(llmCertificationSchema).optional().default([]),
});

export type LlmResumeResponse = z.infer<typeof llmResumeResponseSchema>;

/**
 * Parse and validate raw LLM JSON output against the schema.
 * Returns a discriminated union for safe error handling.
 */
export function parseLlmResumeResponse(raw: unknown): {
  ok: true;
  data: LlmResumeResponse;
} | {
  ok: false;
  error: string;
} {
  const result = llmResumeResponseSchema.safeParse(raw);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  const firstIssue = result.error.issues[0];
  const path = firstIssue?.path?.join(".") ?? "unknown";
  const message = firstIssue?.message ?? "Validation failed";
  return { ok: false, error: `LLM response validation failed at '${path}': ${message}` };
}
