import { z } from "zod";
import { OfferStatus } from "@/generated/prisma/enums";

export const offerListFiltersSchema = z.object({
  q: z.string().trim().optional(),
  status: z
    .enum([
      "all",
      OfferStatus.draft,
      OfferStatus.released,
      OfferStatus.accepted,
      OfferStatus.declined,
      OfferStatus.withdrawn,
    ])
    .default("all"),
  jobOpeningId: z.string().trim().optional().default("all"),
  recruiterUserId: z.string().trim().optional().default("all"),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(25),
  sort: z.enum(["createdAt", "sentAt", "expiresAt", "updatedAt"]).default("createdAt"),
  direction: z.enum(["asc", "desc"]).default("desc"),
});
