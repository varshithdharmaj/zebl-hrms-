import "server-only";

import { prisma } from "@/lib/prisma";
import { JobOpeningStatus } from "@/generated/prisma/enums";
import type { PublicJobOpeningDTO } from "@/lib/recruitment/public-apply/types";

/**
 * Single visibility filter, shared by /apply (list) and /apply/[slug] (detail) —
 * see Phase-3 design §3: both entry points must use the same resolver so a bug
 * in one can't create a bypass in the other.
 */
function publicVisibilityWhere() {
  return {
    status: JobOpeningStatus.open,
    isPubliclyListed: true,
    deletedAt: null,
  } as const;
}

const PUBLIC_JOB_SELECT = {
  publicSlug: true,
  title: true,
  department: true,
  location: true,
  workMode: true,
  employmentType: true,
  description: true,
  publishedAt: true,
} as const;

function toDto(row: {
  publicSlug: string | null;
  title: string;
  department: string | null;
  location: string | null;
  workMode: string | null;
  employmentType: string;
  description: string | null;
  publishedAt: Date | null;
}): PublicJobOpeningDTO {
  return {
    publicSlug: row.publicSlug ?? "",
    title: row.title,
    department: row.department,
    location: row.location,
    workMode: row.workMode,
    employmentType: row.employmentType,
    description: row.description ?? "",
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
  };
}

/** Public job list for /apply — no pagination in V1 (see design §2). */
export async function listPublicJobs(): Promise<PublicJobOpeningDTO[]> {
  const rows = await prisma.jobOpening.findMany({
    where: publicVisibilityWhere(),
    select: PUBLIC_JOB_SELECT,
    orderBy: { publishedAt: "desc" },
    take: 200,
  });
  return rows.map(toDto);
}

/**
 * Resolves a job by its internal id for the write-side flow (start/submit),
 * returning only what those flows need to validate against — never the
 * candidate-facing DTO shape, and never exposed over an API by id.
 * `ownerRecruiterUserId` is included solely so the post-submit HR
 * notification (Phase-3 hardening §4) can target the job's owner without a
 * second query — never returned to the anonymous client.
 */
export async function getOpenPublicJobById(
  jobOpeningId: string
): Promise<{ id: string; title: string; ownerRecruiterUserId: string | null } | null> {
  const job = await prisma.jobOpening.findFirst({
    where: { id: jobOpeningId, ...publicVisibilityWhere() },
    select: { id: true, title: true, ownerRecruiterUserId: true },
  });
  return job;
}

/** Invalid slug, unpublished, closed, and filled all resolve to `null` — see design §3. */
export async function resolvePublicJobBySlug(
  publicSlug: string
): Promise<(PublicJobOpeningDTO & { id: string }) | null> {
  if (!publicSlug) return null;
  const row = await prisma.jobOpening.findFirst({
    where: { publicSlug, ...publicVisibilityWhere() },
    select: { id: true, ...PUBLIC_JOB_SELECT },
  });
  if (!row) return null;
  return { id: row.id, ...toDto(row) };
}
