import type { CandidateAiInsight, IntakeItem } from "@/generated/prisma/client";
import type { CandidateStatus, NoteVisibility } from "@/generated/prisma/enums";
import type { RecruitmentScope } from "@/lib/recruitment/types/scope";
import type {
  PageResult,
  RepositoryTx,
  ScopedListArgs,
  ScopedSearchArgs,
} from "@/lib/recruitment/repositories/types";
import type {
  CandidateCreateData,
  CandidateUpdateData,
  CandidateDetail,
  CandidateListItem,
  CandidateListFilters,
  CandidateSort,
  CandidateStatusCounts,
  CandidateNoteView,
  CandidateDocumentView,
} from "@/lib/recruitment/candidate/types";

export type CandidateDocumentUpdatePatch = Partial<
  Pick<CandidateDocumentView, "fileName" | "documentType" | "version" | "isPrimary">
>;

/** Contract only — Phase 3 implements. */
export type CandidateRepository = {
  createCandidate(data: CandidateCreateData, tx?: RepositoryTx): Promise<{ id: string }>;
  updateCandidate(id: string, patch: CandidateUpdateData, tx?: RepositoryTx): Promise<void>;
  softDeleteCandidate(id: string, tx?: RepositoryTx): Promise<void>;
  setStatus(id: string, status: CandidateStatus, tx?: RepositoryTx): Promise<void>;
  getCandidate(id: string): Promise<CandidateDetail | null>;
  getCandidateOverview(id: string): Promise<CandidateDetail | null>;
  findByEmail(email: string): Promise<CandidateDetail | null>;
  findByPhone(phone: string): Promise<CandidateDetail | null>;
  listCandidates(
    args: Omit<ScopedListArgs, "filters" | "sort"> & {
      filters?: CandidateListFilters;
      sort?: CandidateSort;
    }
  ): Promise<PageResult<CandidateListItem>>;
  searchCandidates(args: ScopedSearchArgs): Promise<PageResult<CandidateListItem>>;
  countCandidates(
    scope: RecruitmentScope,
    filters?: CandidateListFilters
  ): Promise<CandidateStatusCounts>;
  setEmployeeLink(
    candidateId: string,
    employeeId: number,
    tx?: RepositoryTx
  ): Promise<void>;
  markMerged(loserId: string, survivorId: string, tx?: RepositoryTx): Promise<void>;
  upsertExperience(
    candidateId: string,
    data: Record<string, unknown>,
    tx?: RepositoryTx
  ): Promise<{ id: string }>;
  upsertEducation(
    candidateId: string,
    data: Record<string, unknown>,
    tx?: RepositoryTx
  ): Promise<{ id: string }>;
  upsertSkill(
    candidateId: string,
    data: Record<string, unknown>,
    tx?: RepositoryTx
  ): Promise<{ id: string }>;
  upsertProject(
    candidateId: string,
    data: Record<string, unknown>,
    tx?: RepositoryTx
  ): Promise<{ id: string }>;
  upsertCertification(
    candidateId: string,
    data: Record<string, unknown>,
    tx?: RepositoryTx
  ): Promise<{ id: string }>;
  replaceSection(
    candidateId: string,
    section: string,
    rows: readonly Record<string, unknown>[],
    tx?: RepositoryTx
  ): Promise<void>;
  addDocument(
    candidateId: string,
    data: Record<string, unknown>,
    tx?: RepositoryTx
  ): Promise<{ id: string }>;
  setPrimaryResume(documentId: string, tx?: RepositoryTx): Promise<void>;
  softDeleteDocument(documentId: string, tx?: RepositoryTx): Promise<void>;
  getCandidateDocument(documentId: string): Promise<CandidateDocumentView | null>;
  updateCandidateDocument(
    documentId: string,
    patch: CandidateDocumentUpdatePatch,
    tx?: RepositoryTx
  ): Promise<void>;
  restoreCandidateDocument(documentId: string, tx?: RepositoryTx): Promise<void>;
  listCandidateDocuments(candidateId: string): Promise<CandidateDocumentView[]>;
  findDocumentByChecksum(
    candidateId: string,
    checksum: string
  ): Promise<CandidateDocumentView | null>;
  setTags(
    candidateId: string,
    tagIds: readonly string[],
    tx?: RepositoryTx
  ): Promise<void>;
  addTalentPoolEntry(
    candidateId: string,
    data: Record<string, unknown>,
    tx?: RepositoryTx
  ): Promise<{ id: string }>;
  closeTalentPoolEntry(entryId: string, tx?: RepositoryTx): Promise<void>;
  createInsight(
    candidateId: string,
    data: Record<string, unknown>,
    tx?: RepositoryTx
  ): Promise<{ id: string }>;
  getInsight(insightId: string): Promise<CandidateAiInsight | null>;
  listInsights(
    candidateId: string,
    filters?: { insightType?: string; status?: string }
  ): Promise<CandidateAiInsight[]>;
  findReviewableInsights(
    candidateId: string,
    filters: {
      insightType: string;
      statuses: readonly string[];
      take?: number;
    }
  ): Promise<CandidateAiInsight[]>;
  findResumeParseDrafts(
    candidateId: string,
    take?: number
  ): Promise<Array<{ id: string; contentJson: unknown }>>;
  updateInsightStatus(
    insightId: string,
    status: string,
    tx?: RepositoryTx,
    meta?: { reviewedByUserId?: string | null; reviewedAt?: Date | null }
  ): Promise<void>;
  createIntake(data: Record<string, unknown>, tx?: RepositoryTx): Promise<{ id: string }>;
  updateIntake(
    intakeId: string,
    patch: Record<string, unknown>,
    tx?: RepositoryTx
  ): Promise<void>;
  findIntake(intakeId: string): Promise<IntakeItem | null>;
  listIntake(args: ScopedListArgs): Promise<PageResult<IntakeItem>>;

  // Candidate foundation additions
  archiveCandidate(id: string, tx?: RepositoryTx): Promise<void>;
  restoreCandidate(id: string, tx?: RepositoryTx): Promise<void>;
  findByNormalizedEmail(email: string): Promise<CandidateDetail | null>;
  findByNormalizedPhone(phone: string): Promise<CandidateDetail | null>;
  findDuplicateCandidates(email?: string | null, phone?: string | null): Promise<CandidateDetail[]>;

  addNote(
    candidateId: string,
    data: {
      body: string;
      content?: string | null;
      visibility: NoteVisibility;
      authorUserId: string;
      isPinned?: boolean;
      isResolved?: boolean;
    },
    tx?: RepositoryTx
  ): Promise<CandidateNoteView>;
};
