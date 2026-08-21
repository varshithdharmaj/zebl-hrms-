import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import { getEnv } from "@/lib/config/env";

/**
 * Anonymous ownership token for PublicApplicationSubmission — same construction
 * as ApprovalToken (src/lib/approval-tokens/token-validator.ts): opaque
 * `id.signature`, HMAC-SHA256, signature never persisted (only the id half is
 * a real row PK). A DB dump alone does not yield a usable token. Distinct
 * action string ("public_application") so an approval-link token can never be
 * replayed here and vice versa, even though both fall back to the same secret.
 */
const TOKEN_ACTION = "public_application";

function getSecret(): string {
  const secret =
    getEnv("PUBLIC_SUBMISSION_TOKEN_SECRET") ??
    getEnv("APPROVAL_TOKEN_SECRET") ??
    getEnv("AUTH_SECRET");
  if (!secret) {
    throw new Error(
      "PUBLIC_SUBMISSION_TOKEN_SECRET, APPROVAL_TOKEN_SECRET, or AUTH_SECRET must be set"
    );
  }
  return secret;
}

function sign(submissionId: string): string {
  return createHmac("sha256", getSecret())
    .update(`${submissionId}:${TOKEN_ACTION}`)
    .digest("base64url");
}

export function buildSubmissionToken(submissionId: string): string {
  return `${submissionId}.${sign(submissionId)}`;
}

export function parseSubmissionToken(
  raw: string
): { submissionId: string; signature: string } | null {
  const decoded = decodeURIComponent(raw ?? "");
  const dot = decoded.lastIndexOf(".");
  if (dot <= 0 || dot === decoded.length - 1) return null;
  return { submissionId: decoded.slice(0, dot), signature: decoded.slice(dot + 1) };
}

/** Verifies signature only — does not check DB state (status/expiry). */
export function verifySubmissionTokenSignature(raw: string): { submissionId: string } | null {
  const parsed = parseSubmissionToken(raw);
  if (!parsed) return null;

  const expected = sign(parsed.submissionId);
  try {
    const a = Buffer.from(parsed.signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return null;
    if (!timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  return { submissionId: parsed.submissionId };
}
