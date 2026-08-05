import type { OfferStatus } from "@/generated/prisma/enums";
import type {
  PageResult,
  RepositoryTx,
  ScopedListArgs,
} from "@/lib/recruitment/repositories/types";

export type OfferRepository = {
  createOffer(data: Record<string, any>, tx?: RepositoryTx): Promise<{ id: string }>;
  updateOffer(id: string, patch: Record<string, any>, tx?: RepositoryTx): Promise<void>;
  getOffer(id: string): Promise<Record<string, any> | null>;
  listOffers(args: ScopedListArgs): Promise<PageResult<Record<string, any>>>;
  listByApplication(applicationId: string): Promise<readonly Record<string, any>[]>;
  sendOffer(id: string, expiresAt: Date | null, tx?: RepositoryTx): Promise<void>;
  acceptOffer(id: string, acceptedAt: Date | null, tx?: RepositoryTx): Promise<void>;
  declineOffer(
    id: string,
    declinedAt: Date | null,
    reason: string | null,
    tx?: RepositoryTx
  ): Promise<void>;
  withdrawOffer(id: string, reason: string | null, tx?: RepositoryTx): Promise<void>;
  expireOffer(id: string, tx?: RepositoryTx): Promise<void>;
  createRevision(
    offerId: string,
    snapshot: Record<string, any>,
    changeNote: string,
    actorUserId: string,
    tx?: RepositoryTx
  ): Promise<{ id: string }>;
  latestRevision(offerId: string): Promise<Record<string, any> | null>;
  existsActiveOffer(applicationId: string): Promise<boolean>;
};
