import { CandidateStatus, CandidateSource } from "@/generated/prisma/enums";
import type { SessionUser } from "@/lib/session";
import { PermissionError } from "@/lib/permissions";
import {
  RecruitmentPermissionService,
  toRecruitmentActor,
} from "@/lib/recruitment/permissions/permission-service";
import { RecruitmentScopeEngine } from "@/lib/recruitment/permissions/recruitment-scope-engine";
import { prismaCandidateRepository } from "@/lib/recruitment/repositories/prisma-candidate-repository";
import type { CandidateRepository } from "@/lib/recruitment/repositories/candidate-repository";
import { RecruitmentDomainError } from "@/lib/recruitment/shared/errors";
import { withRecruitmentTransaction } from "@/lib/recruitment/shared/transaction";
import { createAfterCommitBuffer } from "@/lib/recruitment/shared/after-commit";
import { RecruitmentEventFactory } from "@/lib/recruitment/events/factory";
import { RecruitmentTimelineService } from "@/lib/recruitment/services/timeline-service";
import { AUDIT_ACTIONS, writeAuditLog } from "@/lib/audit";
import {
  createCandidateSchema,
  updateCandidateSchema,
  addCandidateNoteSchema,
  type AddCandidateNoteInput,
} from "@/lib/validation/schemas/recruitment/candidates";
import {
  normalizeEmail,
  normalizePhone,
} from "@/lib/recruitment/candidate/candidate-normalizer";
import type {
  CandidateCreateData,
  CandidateUpdateData,
  CandidateDetail,
  CandidateListItem,
  CandidateListFilters,
  CandidateSort,
  CandidateNoteView,
  CandidatePersonalInput,
  CandidatePersonalView,
} from "@/lib/recruitment/candidate/types";
import type { PageResult } from "@/lib/recruitment/types/pagination";

function resolvePersonalInput(args: {
  preferredLocation?: string | null;
  portfolioUrl?: string | null;
  nationality?: string | null;
  inputPersonal?: CandidatePersonalInput;
  existingPersonal?: CandidatePersonalView | null;
  force?: boolean;
}): CandidatePersonalInput | undefined {
  const {
    preferredLocation,
    portfolioUrl,
    nationality,
    inputPersonal,
    existingPersonal,
    force = false,
  } = args;

  const touched =
    force ||
    preferredLocation !== undefined ||
    portfolioUrl !== undefined ||
    nationality !== undefined ||
    inputPersonal !== undefined;

  if (!touched) return undefined;

  return {
    nationality:
      nationality !== undefined
        ? nationality
        : (inputPersonal?.nationality ?? existingPersonal?.nationality ?? null),
    currentLocation:
      inputPersonal?.currentLocation ?? existingPersonal?.currentLocation ?? null,
    preferredLocation:
      preferredLocation !== undefined
        ? preferredLocation
        : (inputPersonal?.preferredLocation ?? existingPersonal?.preferredLocation ?? null),
    noticePeriod: inputPersonal?.noticePeriod ?? existingPersonal?.noticePeriod ?? null,
    availabilityDate:
      inputPersonal?.availabilityDate ?? existingPersonal?.availabilityDate ?? null,
    linkedinUrl: inputPersonal?.linkedinUrl ?? existingPersonal?.linkedinUrl ?? null,
    portfolioUrl:
      portfolioUrl !== undefined
        ? portfolioUrl
        : (inputPersonal?.portfolioUrl ?? existingPersonal?.portfolioUrl ?? null),
  };
}

export function createCandidateService(repository: CandidateRepository = prismaCandidateRepository) {
  return {
    async createCandidate(
      session: SessionUser,
      input: CandidateCreateData
    ): Promise<{ id: string }> {
      RecruitmentPermissionService.requireModuleEnabled();
      await RecruitmentPermissionService.assertCanManageCandidates(session);
      const actor = toRecruitmentActor(session);

      // Validate base fields
      const parsed = createCandidateSchema.parse(input);

      // Normalize
      const normalizedEmail = normalizeEmail(parsed.email);
      const normalizedPhone = normalizePhone(parsed.phone);

      // Duplicate Detection V1
      if (normalizedEmail) {
        const existing = await repository.findByNormalizedEmail(normalizedEmail);
        if (existing) {
          throw new RecruitmentDomainError(
            "REC_CONFLICT",
            "Candidate with this email already exists.",
            {
              duplicateCandidateId: existing.id,
              reason: "Candidate with this email already exists.",
              matchingField: "email",
            }
          );
        }
      }

      if (normalizedPhone) {
        const existing = await repository.findByNormalizedPhone(normalizedPhone);
        if (existing) {
          throw new RecruitmentDomainError(
            "REC_CONFLICT",
            "Candidate with this phone number already exists.",
            {
              duplicateCandidateId: existing.id,
              reason: "Candidate with this phone number already exists.",
              matchingField: "phone",
            }
          );
        }
      }

      // Check primary resume constraint
      const primaryDocs = input.documents?.filter((doc) => doc.isPrimary);
      if (primaryDocs && primaryDocs.length > 1) {
        throw new RecruitmentDomainError(
          "REC_VALIDATION",
          "Only one primary resume is allowed per candidate."
        );
      }

      const events = createAfterCommitBuffer();
      const personal = resolvePersonalInput({
        preferredLocation: parsed.preferredLocation,
        portfolioUrl: parsed.portfolioUrl,
        nationality: parsed.nationality,
        inputPersonal: input.personal,
        force: Boolean(
          parsed.preferredLocation ||
            parsed.portfolioUrl ||
            parsed.nationality ||
            input.personal
        ),
      });

      const candidateId = await withRecruitmentTransaction(async (tx) => {
        const created = await repository.createCandidate(
          {
            ...input,
            ...parsed,
            normalizedEmail,
            normalizedPhone,
            personal,
            experiences: input.experiences,
            educations: input.educations,
            skills: input.skills,
            projects: input.projects,
            certifications: input.certifications,
            documents: input.documents,
            notes: input.notes,
          },
          tx
        );

        events.enqueue(
          RecruitmentEventFactory.candidateCreated(actor, {
            candidateId: created.id,
            fullName: parsed.fullName,
            source: parsed.source ?? "manual_upload",
            status: parsed.status ?? "active",
          })
        );

        return created.id;
      });

      await events.flush();

      // Timeline
      await RecruitmentTimelineService.append({
        entityType: "candidate",
        entityId: candidateId,
        candidateId,
        eventType: "CandidateCreated",
        summary: "Candidate profile created",
        actorUserId: session.id,
        metadata: { fullName: parsed.fullName },
      });

      return { id: candidateId };
    },

    async updateCandidate(
      session: SessionUser,
      id: string,
      input: CandidateUpdateData
    ): Promise<void> {
      RecruitmentPermissionService.requireModuleEnabled();
      await RecruitmentPermissionService.assertCanManageCandidates(session);
      const actor = toRecruitmentActor(session);

      const allowed = await RecruitmentScopeEngine.canManageCandidate(actor, id);
      if (!allowed) {
        throw new PermissionError("Candidate outside recruitment scope.");
      }

      const existing = await repository.getCandidate(id);
      if (!existing) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Candidate not found.");
      }

      const parsed = updateCandidateSchema.parse({ ...input, id });

      const normalizedEmail = parsed.email !== undefined ? normalizeEmail(parsed.email) : undefined;
      const normalizedPhone = parsed.phone !== undefined ? normalizePhone(parsed.phone) : undefined;

      if (normalizedEmail && normalizedEmail !== existing.normalizedEmail) {
        const clash = await repository.findByNormalizedEmail(normalizedEmail);
        if (clash && clash.id !== id) {
          throw new RecruitmentDomainError(
            "REC_CONFLICT",
            "Candidate with this email already exists.",
            {
              duplicateCandidateId: clash.id,
              reason: "Candidate with this email already exists.",
              matchingField: "email",
            }
          );
        }
      }

      if (normalizedPhone && normalizedPhone !== existing.normalizedPhone) {
        const clash = await repository.findByNormalizedPhone(normalizedPhone);
        if (clash && clash.id !== id) {
          throw new RecruitmentDomainError(
            "REC_CONFLICT",
            "Candidate with this phone number already exists.",
            {
              duplicateCandidateId: clash.id,
              reason: "Candidate with this phone number already exists.",
              matchingField: "phone",
            }
          );
        }
      }

      const events = createAfterCommitBuffer();
      const personal = resolvePersonalInput({
        preferredLocation: parsed.preferredLocation,
        portfolioUrl: parsed.portfolioUrl,
        nationality: parsed.nationality,
        inputPersonal: input.personal,
        existingPersonal: existing.personal,
        force:
          parsed.preferredLocation !== undefined ||
          parsed.portfolioUrl !== undefined ||
          parsed.nationality !== undefined ||
          input.personal !== undefined,
      });

      await withRecruitmentTransaction(async (tx) => {
        await repository.updateCandidate(
          id,
          {
            ...input,
            ...parsed,
            ...(normalizedEmail !== undefined ? { normalizedEmail } : {}),
            ...(normalizedPhone !== undefined ? { normalizedPhone } : {}),
            ...(personal !== undefined ? { personal } : {}),
          },
          tx
        );

        events.enqueue(
          RecruitmentEventFactory.candidateUpdated(actor, {
            candidateId: id,
            changedFields: Object.keys(input),
          })
        );
      });

      await events.flush();

      // Timeline
      await RecruitmentTimelineService.append({
        entityType: "candidate",
        entityId: id,
        candidateId: id,
        eventType: "CandidateUpdated",
        summary: "Candidate profile updated",
        actorUserId: session.id,
        metadata: { changedFields: Object.keys(input) },
      });
    },

    async archiveCandidate(session: SessionUser, id: string): Promise<void> {
      RecruitmentPermissionService.requireModuleEnabled();
      await RecruitmentPermissionService.assertCanManageCandidates(session);
      const actor = toRecruitmentActor(session);

      const allowed = await RecruitmentScopeEngine.canManageCandidate(actor, id);
      if (!allowed) {
        throw new PermissionError("Candidate outside recruitment scope.");
      }

      const existing = await repository.getCandidate(id);
      if (!existing) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Candidate not found.");
      }

      if (existing.archivedAt) return;

      const events = createAfterCommitBuffer();
      await withRecruitmentTransaction(async (tx) => {
        await repository.archiveCandidate(id, tx);
        events.enqueue(
          RecruitmentEventFactory.candidateArchived(actor, {
            candidateId: id,
            previousStatus: existing.status,
          })
        );
      });

      await events.flush();

      // Timeline
      await RecruitmentTimelineService.append({
        entityType: "candidate",
        entityId: id,
        candidateId: id,
        eventType: "CandidateArchived",
        summary: "Candidate profile archived",
        actorUserId: session.id,
        metadata: { previousStatus: existing.status },
      });
    },

    async restoreCandidate(session: SessionUser, id: string): Promise<void> {
      RecruitmentPermissionService.requireModuleEnabled();
      await RecruitmentPermissionService.assertCanManageCandidates(session);
      const actor = toRecruitmentActor(session);

      const allowed = await RecruitmentScopeEngine.canManageCandidate(actor, id);
      if (!allowed) {
        throw new PermissionError("Candidate outside recruitment scope.");
      }

      const existing = await repository.getCandidate(id);
      if (!existing) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Candidate not found.");
      }

      if (!existing.archivedAt) return;

      const events = createAfterCommitBuffer();
      await withRecruitmentTransaction(async (tx) => {
        await repository.restoreCandidate(id, tx);
        events.enqueue(
          RecruitmentEventFactory.candidateRestored(actor, {
            candidateId: id,
            status: "active",
          })
        );
      });

      await events.flush();

      // Timeline
      await RecruitmentTimelineService.append({
        entityType: "candidate",
        entityId: id,
        candidateId: id,
        eventType: "CandidateRestored",
        summary: "Candidate profile restored",
        actorUserId: session.id,
        metadata: { status: "active" },
      });
    },

    async mergeCandidate(
      session: SessionUser,
      sourceId: string,
      targetId: string
    ): Promise<void> {
      RecruitmentPermissionService.requireModuleEnabled();
      await RecruitmentPermissionService.assertCanManageCandidates(session);
      const actor = toRecruitmentActor(session);

      if (sourceId === targetId) {
        throw new RecruitmentDomainError(
          "REC_VALIDATION",
          "Cannot merge a candidate into themselves."
        );
      }

      const allowedSource = await RecruitmentScopeEngine.canManageCandidate(actor, sourceId);
      const allowedTarget = await RecruitmentScopeEngine.canManageCandidate(actor, targetId);
      if (!allowedSource || !allowedTarget) {
        throw new PermissionError("Candidate outside recruitment scope.");
      }

      const source = await repository.getCandidate(sourceId);
      const target = await repository.getCandidate(targetId);

      if (!source || !target) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Candidate not found.");
      }

      if (source.status === CandidateStatus.merged) {
        throw new RecruitmentDomainError(
          "REC_CONFLICT",
          "Source candidate is already merged."
        );
      }

      const events = createAfterCommitBuffer();
      await withRecruitmentTransaction(async (tx) => {
        await repository.markMerged(sourceId, targetId, tx);
        await repository.archiveCandidate(sourceId, tx);

        events.enqueue(
          RecruitmentEventFactory.candidateMerged(actor, {
            survivorCandidateId: targetId,
            loserCandidateId: sourceId,
          })
        );
      });

      await events.flush();

      // Timeline for survivor
      await RecruitmentTimelineService.append({
        entityType: "candidate",
        entityId: targetId,
        candidateId: targetId,
        eventType: "CandidateMerged",
        summary: "Candidate records merged",
        actorUserId: session.id,
        metadata: { survivorCandidateId: targetId, loserCandidateId: sourceId },
      });

      // Timeline for loser
      await RecruitmentTimelineService.append({
        entityType: "candidate",
        entityId: sourceId,
        candidateId: sourceId,
        eventType: "CandidateMerged",
        summary: "Candidate records merged (archived)",
        actorUserId: session.id,
        metadata: { survivorCandidateId: targetId, loserCandidateId: sourceId },
      });
    },

    async getCandidate(session: SessionUser, id: string): Promise<CandidateDetail> {
      RecruitmentPermissionService.requireModuleEnabled();
      const actor = toRecruitmentActor(session);

      const allowed = await RecruitmentScopeEngine.canViewCandidate(actor, id);
      if (!allowed) {
        throw new PermissionError("Candidate outside recruitment scope.");
      }

      const candidate = await repository.getCandidate(id);
      if (!candidate) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Candidate not found.");
      }

      return candidate;
    },

    async listCandidates(
      session: SessionUser,
      args: {
        filters?: CandidateListFilters;
        pagination: { page: number; pageSize: number };
        sort?: CandidateSort;
      }
    ): Promise<PageResult<CandidateListItem>> {
      RecruitmentPermissionService.requireModuleEnabled();
      const actor = toRecruitmentActor(session);
      const scope = await RecruitmentScopeEngine.resolveScope(actor);

      return repository.listCandidates({
        scope,
        filters: args.filters,
        pagination: args.pagination,
        sort: args.sort,
      });
    },

    async searchCandidates(
      session: SessionUser,
      args: {
        query: string;
        pagination: { page: number; pageSize: number };
      }
    ): Promise<PageResult<CandidateListItem>> {
      RecruitmentPermissionService.requireModuleEnabled();
      const actor = toRecruitmentActor(session);
      const scope = await RecruitmentScopeEngine.resolveScope(actor);

      return repository.searchCandidates({
        scope,
        query: args.query,
        pagination: args.pagination,
      });
    },

    // Internal helper for potential duplicates
    async findPotentialDuplicates(
      fullName: string,
      currentCompany: string | null | undefined
    ): Promise<CandidateDetail[]> {
      if (!fullName || !currentCompany) return [];
      return repository.findDuplicateCandidates(null, null); // Or custom heuristic query
    },

    async addCandidateNote(
      session: SessionUser,
      input: AddCandidateNoteInput
    ): Promise<CandidateNoteView> {
      const parsed = addCandidateNoteSchema.parse(input);

      await RecruitmentPermissionService.assertCanWriteCandidateDiscussion(
        session,
        parsed.candidateId
      );

      const existing = await repository.getCandidate(parsed.candidateId);
      if (!existing || existing.deletedAt) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Candidate not found.");
      }

      const note = await withRecruitmentTransaction(async (tx) => {
        return repository.addNote(
          parsed.candidateId,
          {
            body: parsed.body,
            content: parsed.body,
            visibility: parsed.visibility,
            authorUserId: session.id,
          },
          tx
        );
      });

      await RecruitmentTimelineService.append({
        entityType: "candidate",
        entityId: parsed.candidateId,
        candidateId: parsed.candidateId,
        eventType: "CandidateNoteAdded",
        summary: "Internal recruiting note added",
        actorUserId: session.id,
        metadata: {
          noteId: note.id,
          visibility: note.visibility,
        },
      });

      await writeAuditLog({
        entityType: "candidate",
        entityId: parsed.candidateId,
        action: AUDIT_ACTIONS.RECRUITMENT_CANDIDATE_NOTE_ADDED,
        actorUserId: session.id,
        actorEmail: session.email,
        employeeId: session.employeeId,
        module: "recruitment",
        description: "Candidate internal note added",
        metadata: {
          noteId: note.id,
          visibility: note.visibility,
        },
      });

      return note;
    },
  };
}
