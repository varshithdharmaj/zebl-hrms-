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

export const llmMatchScoreSchema = z.object({
  /** Null whenever no job description was supplied in the prompt — never fabricated. */
  value: z.number().min(0).max(100).nullable().optional().default(null),
  rationale: z.string().nullable().optional().default(null),
});

export const llmAiInsightsSchema = z.object({
  executiveSummary: z.string().nullable().optional().default(null),
  strengths: z.array(z.string()).optional().default([]),
  /** Phrased as open questions for a recruiter, not conclusions. See bias guard in the system prompt. */
  gaps: z.array(z.string()).optional().default([]),
  matchScore: llmMatchScoreSchema.optional().default({ value: null, rationale: null }),
  clarificationFlags: z.array(z.string()).optional().default([]),
});

export const llmExtractionMetaSchema = z.object({
  documentQuality: z.enum(["clean", "degraded", "image_only"]).optional().default("clean"),
  /** Dot-paths into the response, e.g. "experiences.2.endDate" — drives review-screen highlighting. */
  fieldsRequiringReview: z.array(z.string()).optional().default([]),
  languageDetected: z.string().nullable().optional().default(null),
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
  aiInsights: llmAiInsightsSchema.optional().default({
    executiveSummary: null,
    strengths: [],
    gaps: [],
    matchScore: { value: null, rationale: null },
    clarificationFlags: [],
  }),
  extractionMeta: llmExtractionMetaSchema.optional().default({
    documentQuality: "clean",
    fieldsRequiringReview: [],
    languageDetected: null,
  }),
});

export type LlmResumeResponse = z.infer<typeof llmResumeResponseSchema>;
export type LlmAiInsights = z.infer<typeof llmAiInsightsSchema>;
export type LlmExtractionMeta = z.infer<typeof llmExtractionMetaSchema>;

/**
 * Gemini `generationConfig.responseSchema` — OpenAPI 3.0 subset, uppercase types.
 * Constrains decode-time output shape; Zod above still enforces domain rules
 * (date ordering, enum-adjacent cross-field checks) that responseSchema can't express.
 */
const nullableString = { type: "STRING", nullable: true } as const;

export const GEMINI_RESUME_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    fullName: nullableString,
    firstName: nullableString,
    lastName: nullableString,
    email: nullableString,
    phone: nullableString,
    location: nullableString,
    headline: nullableString,
    professionalSummary: nullableString,
    currentCompany: nullableString,
    currentTitle: nullableString,
    totalExperienceYears: nullableString,
    linkedinUrl: nullableString,
    githubUrl: nullableString,
    portfolioUrl: nullableString,
    experiences: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          company: { type: "STRING" },
          title: { type: "STRING" },
          location: nullableString,
          startDate: nullableString,
          endDate: nullableString,
          isCurrent: { type: "BOOLEAN" },
          description: nullableString,
        },
        required: ["company", "title"],
      },
    },
    educations: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          institution: { type: "STRING" },
          degree: nullableString,
          field: nullableString,
          startYear: { type: "INTEGER", nullable: true },
          endYear: { type: "INTEGER", nullable: true },
          grade: nullableString,
        },
        required: ["institution"],
      },
    },
    skills: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          proficiency: nullableString,
          yearsOfExperience: { type: "NUMBER", nullable: true },
        },
        required: ["name"],
      },
    },
    projects: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          summary: nullableString,
          techStack: nullableString,
          url: nullableString,
          role: nullableString,
          duration: nullableString,
        },
        required: ["title"],
      },
    },
    certifications: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          issuer: nullableString,
          issuedAt: nullableString,
          expiresAt: nullableString,
          credentialId: nullableString,
          credentialUrl: nullableString,
        },
        required: ["name"],
      },
    },
    aiInsights: {
      type: "OBJECT",
      properties: {
        executiveSummary: nullableString,
        strengths: { type: "ARRAY", items: { type: "STRING" } },
        gaps: { type: "ARRAY", items: { type: "STRING" } },
        matchScore: {
          type: "OBJECT",
          properties: {
            value: { type: "NUMBER", nullable: true },
            rationale: nullableString,
          },
          required: ["value", "rationale"],
        },
        clarificationFlags: { type: "ARRAY", items: { type: "STRING" } },
      },
      required: ["executiveSummary", "strengths", "gaps", "matchScore", "clarificationFlags"],
    },
    extractionMeta: {
      type: "OBJECT",
      properties: {
        documentQuality: { type: "STRING", enum: ["clean", "degraded", "image_only"] },
        fieldsRequiringReview: { type: "ARRAY", items: { type: "STRING" } },
        languageDetected: nullableString,
      },
      required: ["documentQuality", "fieldsRequiringReview"],
    },
  },
  required: ["fullName", "aiInsights", "extractionMeta"],
} as const;

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
