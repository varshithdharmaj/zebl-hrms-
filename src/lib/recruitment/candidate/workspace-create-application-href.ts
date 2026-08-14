import {
  buildRecruitmentEntityHref,
  isSafeRecruitmentReturnTo,
  RECRUITMENT_BASE_PATH,
} from "@/lib/recruitment/navigation/return-to";

/**
 * Candidate → New Application with validated returnTo (Phase 1 helpers only).
 */
export function buildCandidateCreateApplicationHref(input: {
  candidateId: string;
  returnTo?: string | null;
}): string {
  const fallbackReturn = `${RECRUITMENT_BASE_PATH}/candidates/${input.candidateId}`;
  const returnTo = isSafeRecruitmentReturnTo(input.returnTo)
    ? input.returnTo
    : fallbackReturn;

  const withReturn = buildRecruitmentEntityHref(
    `${RECRUITMENT_BASE_PATH}/applications/new`,
    { returnTo }
  );
  const [path, qs] = withReturn.split("?");
  const params = new URLSearchParams(qs ?? "");
  params.set("candidateId", input.candidateId);
  return `${path}?${params.toString()}`;
}
