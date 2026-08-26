import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/session";
import { RecruitmentPermissionService } from "@/lib/recruitment/permissions/permission-service";
import { RecruitmentDomainError } from "@/lib/recruitment/shared/errors";

export type RecruitmentTagView = {
  id: string;
  name: string;
  color: string | null;
};

/**
 * Activates the previously-dormant RecruitmentTag/CandidateTag models —
 * schema already existed (Phase 1 audit), no migration needed here. A tag
 * is global (shared across candidates, `name` is unique); tagging a
 * candidate just creates the join row. Kept deliberately thin: no color
 * picker, no tag management screen — recruiters type a name, it's reused
 * if it already exists or created on the spot.
 */
export function createTagService() {
  return {
    /** All tags, alphabetical — used to populate the "existing tags" picker. */
    async listTags(): Promise<RecruitmentTagView[]> {
      const rows = await prisma.recruitmentTag.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, color: true },
      });
      return rows;
    },

    async listCandidateTags(candidateId: string): Promise<RecruitmentTagView[]> {
      const rows = await prisma.candidateTag.findMany({
        where: { candidateId },
        orderBy: { createdAt: "asc" },
        select: { tag: { select: { id: true, name: true, color: true } } },
      });
      return rows.map((r) => r.tag);
    },

    /** Finds-or-creates the tag by name, then tags the candidate (idempotent). */
    async addCandidateTag(
      session: SessionUser,
      input: { candidateId: string; tagName: string }
    ): Promise<RecruitmentTagView> {
      RecruitmentPermissionService.requireModuleEnabled();
      await RecruitmentPermissionService.assertCanManageCandidates(session);

      const name = input.tagName.trim();
      if (!name) {
        throw new RecruitmentDomainError("REC_VALIDATION", "Tag name is required.");
      }
      if (name.length > 40) {
        throw new RecruitmentDomainError("REC_VALIDATION", "Tag name must be 40 characters or fewer.");
      }

      const candidate = await prisma.candidate.findUnique({
        where: { id: input.candidateId },
        select: { id: true, deletedAt: true },
      });
      if (!candidate || candidate.deletedAt) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Candidate not found.");
      }

      const tag = await prisma.recruitmentTag.upsert({
        where: { name },
        create: { name },
        update: {},
        select: { id: true, name: true, color: true },
      });

      await prisma.candidateTag.upsert({
        where: { candidateId_tagId: { candidateId: input.candidateId, tagId: tag.id } },
        create: { candidateId: input.candidateId, tagId: tag.id },
        update: {},
      });

      return tag;
    },

    async removeCandidateTag(
      session: SessionUser,
      input: { candidateId: string; tagId: string }
    ): Promise<void> {
      RecruitmentPermissionService.requireModuleEnabled();
      await RecruitmentPermissionService.assertCanManageCandidates(session);

      await prisma.candidateTag.deleteMany({
        where: { candidateId: input.candidateId, tagId: input.tagId },
      });
    },
  };
}

export const TagService = createTagService();
