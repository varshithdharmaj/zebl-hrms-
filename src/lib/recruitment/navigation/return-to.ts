/** Internal Recruitment return URLs only — no open redirects. */

export const RECRUITMENT_BASE_PATH = "/admin/recruitment";

const UNSAFE_RETURN_CHARS = /[\s<>'"`\\]/;
const MAX_PATH_DECODE_PASSES = 5;

/**
 * Decode a path repeatedly until stable.
 * Returns null on malformed percent-encoding or pathological nesting.
 */
function decodePathFully(path: string): string | null {
  let current = path;
  for (let i = 0; i < MAX_PATH_DECODE_PASSES; i++) {
    try {
      const decoded = decodeURIComponent(current);
      if (decoded === current) return current;
      current = decoded;
    } catch {
      return null;
    }
  }
  // Still changing after max passes — treat as unsafe.
  try {
    if (decodeURIComponent(current) !== current) return null;
  } catch {
    return null;
  }
  return current;
}

function hasTraversalSegment(path: string): boolean {
  return path.split("/").some((segment) => segment === "." || segment === "..");
}

export function isSafeRecruitmentReturnTo(
  value: string | null | undefined
): value is string {
  if (!value || typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed !== value) return false;
  if (!trimmed.startsWith(RECRUITMENT_BASE_PATH)) return false;
  if (trimmed.startsWith("//")) return false;
  if (trimmed.includes("://")) return false;
  if (UNSAFE_RETURN_CHARS.test(trimmed)) return false;

  const pathOnly = trimmed.split(/[?#]/, 1)[0] ?? trimmed;
  if (pathOnly.includes("..")) return false;

  const decodedPath = decodePathFully(pathOnly);
  if (decodedPath == null) return false;
  if (!decodedPath.startsWith(RECRUITMENT_BASE_PATH)) return false;
  if (decodedPath.startsWith("//")) return false;
  if (decodedPath.includes("://")) return false;
  if (UNSAFE_RETURN_CHARS.test(decodedPath)) return false;
  if (hasTraversalSegment(decodedPath)) return false;
  if (decodedPath.includes("..")) return false;

  return true;
}

export function resolveRecruitmentReturnTo(
  returnTo: string | null | undefined,
  fallback: string
): string {
  return isSafeRecruitmentReturnTo(returnTo) ? returnTo : fallback;
}

export function returnToLabel(returnTo: string | null | undefined, fallback: string): string {
  if (!isSafeRecruitmentReturnTo(returnTo)) return fallback;
  const path = returnTo.split("?")[0] ?? returnTo;
  if (path === `${RECRUITMENT_BASE_PATH}/pipeline` || path.startsWith(`${RECRUITMENT_BASE_PATH}/pipeline/`)) {
    return "Back to pipeline";
  }
  if (path === `${RECRUITMENT_BASE_PATH}/candidates` || path.startsWith(`${RECRUITMENT_BASE_PATH}/candidates/`)) {
    return "Back to candidate";
  }
  if (path === `${RECRUITMENT_BASE_PATH}/jobs` || path.startsWith(`${RECRUITMENT_BASE_PATH}/jobs/`)) {
    return "Back to job";
  }
  if (path === `${RECRUITMENT_BASE_PATH}/applications` || path.startsWith(`${RECRUITMENT_BASE_PATH}/applications/`)) {
    return "Back to application";
  }
  if (path === `${RECRUITMENT_BASE_PATH}/interviews` || path.startsWith(`${RECRUITMENT_BASE_PATH}/interviews/`)) {
    return "Back to interviews";
  }
  if (path === `${RECRUITMENT_BASE_PATH}/offers` || path.startsWith(`${RECRUITMENT_BASE_PATH}/offers/`)) {
    return "Back to offer";
  }
  if (path === `${RECRUITMENT_BASE_PATH}/conversions` || path.startsWith(`${RECRUITMENT_BASE_PATH}/conversions/`)) {
    return "Back to conversions";
  }
  return "Back";
}

export type RecruitmentQueryContext = {
  returnTo?: string | null;
  jobOpeningId?: string | null;
  applicationId?: string | null;
  currentStage?: string | null;
};

function appendContextParams(
  params: URLSearchParams,
  context: RecruitmentQueryContext,
  options?: { includeReturnTo?: boolean }
): void {
  const includeReturnTo = options?.includeReturnTo !== false;
  if (includeReturnTo && isSafeRecruitmentReturnTo(context.returnTo)) {
    params.set("returnTo", context.returnTo);
  }
  if (context.jobOpeningId) params.set("jobOpeningId", context.jobOpeningId);
  if (context.applicationId) params.set("applicationId", context.applicationId);
  if (context.currentStage) params.set("currentStage", context.currentStage);
}

export function buildPipelineHref(context: {
  applicationId?: string | null;
  jobOpeningId?: string | null;
  currentStage?: string | null;
  returnTo?: string | null;
}): string {
  const params = new URLSearchParams();
  if (context.jobOpeningId) params.set("jobOpeningId", context.jobOpeningId);
  if (context.currentStage) params.set("currentStage", context.currentStage);
  if (context.applicationId) params.set("applicationId", context.applicationId);
  if (isSafeRecruitmentReturnTo(context.returnTo)) {
    params.set("returnTo", context.returnTo);
  }
  const qs = params.toString();
  return qs ? `${RECRUITMENT_BASE_PATH}/pipeline?${qs}` : `${RECRUITMENT_BASE_PATH}/pipeline`;
}

/** Post-create redirect: pipeline with the new application selected. */
export function buildApplicationCreateRedirect(input: {
  applicationId: string;
  jobOpeningId?: string | null;
  currentStage?: string | null;
  returnTo?: string | null;
}): string {
  return buildPipelineHref({
    applicationId: input.applicationId,
    jobOpeningId: input.jobOpeningId,
    currentStage: input.currentStage,
    returnTo: input.returnTo,
  });
}

export function buildRecruitmentEntityHref(
  pathname: string,
  context: RecruitmentQueryContext = {}
): string {
  const params = new URLSearchParams();
  appendContextParams(params, context);
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function parseRecruitmentNavSearch(
  raw: Record<string, string | string[] | undefined>
): RecruitmentQueryContext {
  const pick = (key: string): string | undefined => {
    const value = raw[key];
    return typeof value === "string" && value.length > 0 ? value : undefined;
  };
  return {
    returnTo: pick("returnTo"),
    jobOpeningId: pick("jobOpeningId"),
    applicationId: pick("applicationId"),
    currentStage: pick("currentStage"),
  };
}

export function currentPathWithSearch(pathname: string, search: string): string {
  const qs = search.startsWith("?") ? search.slice(1) : search;
  return qs ? `${pathname}?${qs}` : pathname;
}
