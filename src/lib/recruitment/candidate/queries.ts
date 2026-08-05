import { cache } from "react";
import type { SessionUser } from "@/lib/session";
import { createCandidateService } from "@/lib/recruitment/services/candidate-service";
import type { CandidateListFilters, CandidateSort } from "@/lib/recruitment/candidate/types";
import { normalizePagination } from "@/lib/recruitment/shared/pagination";

export const getCandidateCached = cache(async (session: SessionUser, candidateId: string) => {
  const service = createCandidateService();
  return service.getCandidate(session, candidateId);
});

export const listCandidatesCached = cache(
  async (
    session: SessionUser,
    filters: CandidateListFilters,
    pagination: { page: number; pageSize: number },
    sort: CandidateSort
  ) => {
    const service = createCandidateService();
    return service.listCandidates(session, {
      filters,
      pagination: normalizePagination(pagination),
      sort,
    });
  }
);

export const searchCandidatesCached = cache(
  async (
    session: SessionUser,
    query: string,
    pagination: { page: number; pageSize: number }
  ) => {
    const service = createCandidateService();
    return service.searchCandidates(session, {
      query,
      pagination: normalizePagination(pagination),
    });
  }
);
