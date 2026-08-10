import type { Offer, OfferRevision, Prisma } from "@/generated/prisma/client";
import type { OfferStatus } from "@/generated/prisma/enums";
import type {
  PageResult,
  RepositoryTx,
  ScopedListArgs,
} from "@/lib/recruitment/repositories/types";

/** Fields consumed by application-detail (and compatible supersets from listByApplication). */
export type OfferByApplication = {
  id: string;
  status: OfferStatus;
  offerNumber: string | null;
  ctc: number | null;
  currency: string | null;
  joiningDate: Date | null;
};

export type OfferListFilters = {
  status?: string;
  department?: string;
  jobOpeningId?: string;
  applicationId?: string;
  recruiterUserId?: string;
  q?: string;
  includeArchived?: boolean;
};

/** Prisma include used by getOffer detail rows. */
export const offerDetailInclude = {
  application: {
    include: {
      candidate: true,
      jobOpening: true,
    },
  },
  createdBy: {
    select: { id: true, email: true },
  },
  revisions: {
    orderBy: { version: "desc" as const },
  },
} as const;

/** Lean include for offer lists — omits revisions (detail-only). */
export const offerListInclude = {
  application: {
    include: {
      candidate: true,
      jobOpening: true,
    },
  },
  createdBy: {
    select: { id: true, email: true },
  },
} as const;

export type OfferDetailRow = Prisma.OfferGetPayload<{
  include: typeof offerDetailInclude;
}>;

/** Detail row after Decimal → number mapping for RSC/client boundaries. */
export type OfferDetail = Omit<
  OfferDetailRow,
  "baseSalary" | "variablePay" | "ctc" | "bonus"
> & {
  baseSalary: number;
  variablePay: number | null;
  ctc: number | null;
  bonus: number | null;
};

export type OfferCreateData = {
  applicationId: string;
  hiringDecisionId?: string | null;
  status?: OfferStatus;
  currency?: string;
  baseSalary: number | string;
  variablePay?: number | string | null;
  benefitsNotes?: string | null;
  proposedStartDate?: string | Date | null;
  expiresAt?: string | Date | null;
  createdByUserId?: string | null;
  offerNumber?: string | null;
  employmentType?: string | null;
  department?: string | null;
  location?: string | null;
  grade?: string | null;
  reportingManagerId?: number | null;
  joiningDate?: string | Date | null;
  ctc?: number | string | null;
  salaryBreakdownJson?: Prisma.InputJsonValue;
  bonus?: number | string | null;
  stock?: string | null;
  probationDays?: number | null;
  noticeBuyout?: boolean;
  offerPdfKey?: string | null;
  offerNotes?: string | null;
};

export type OfferUpdateData = Partial<OfferCreateData> & {
  status?: OfferStatus;
  releasedAt?: Date | null;
  sentAt?: Date | null;
  acceptedAt?: Date | null;
  declinedAt?: Date | null;
  withdrawnAt?: Date | null;
};

export type OfferRevisionSnapshot = Prisma.InputJsonValue;

export type OfferRevisionRow = OfferRevision;

export type OfferRepository = {
  createOffer(data: OfferCreateData, tx?: RepositoryTx): Promise<{ id: string }>;
  updateOffer(id: string, patch: OfferUpdateData, tx?: RepositoryTx): Promise<void>;
  getOffer(id: string): Promise<OfferDetail | null>;
  listOffers(args: ScopedListArgs): Promise<PageResult<OfferDetail>>;
  listByApplication(applicationId: string): Promise<readonly OfferByApplication[]>;
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
    snapshot: OfferRevisionSnapshot,
    changeNote: string,
    actorUserId: string,
    tx?: RepositoryTx
  ): Promise<{ id: string }>;
  latestRevision(offerId: string): Promise<OfferRevisionRow | null>;
  existsActiveOffer(applicationId: string): Promise<boolean>;
};

export type { Offer };
