import { cache } from "react";
import type { SessionUser } from "@/lib/session";
import { createCandidateService } from "@/lib/recruitment/services/candidate-service";
import type { CandidateListFilters, CandidateSort } from "@/lib/recruitment/candidate/types";
import { normalizePagination } from "@/lib/recruitment/shared/pagination";

export const getCandidateCached = cache(async (session: SessionUser, candidateId: string) => {
  const service = createCandidateService();
  return service.getCandidate(session, candidateId);
});

export const getCandidateOverviewCached = cache(
  async (session: SessionUser, candidateId: string) => {
    const service = createCandidateService();
    return service.getCandidateOverview(session, candidateId);
  }
);

export const listCandidateDocumentsCached = cache(
  async (session: SessionUser, candidateId: string) => {
    const service = createCandidateService();
    return service.listCandidateDocuments(session, candidateId);
  }
);

export const getCandidateTimelineCached = cache(
  async (session: SessionUser, candidateId: string, limit = 50) => {
    const service = createCandidateService();
    return service.getCandidateTimeline(session, candidateId, limit);
  }
);

export const listResumeParseDraftsCached = cache(
  async (session: SessionUser, candidateId: string, take = 5) => {
    const service = createCandidateService();
    return service.listResumeParseDrafts(session, candidateId, take);
  }
);

export const getResumeParseDraftCached = cache(
  async (session: SessionUser, candidateId: string, draftId: string) => {
    const service = createCandidateService();
    return service.getResumeParseDraft(session, candidateId, draftId);
  }
);

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
