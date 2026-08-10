import { cache } from "react";
import type { SessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { createHiringDecisionService } from "@/lib/recruitment/services/hiring-decision-service";

export const getCurrentHiringDecisionCached = cache(
  async (session: SessionUser, applicationId: string) => {
    const service = createHiringDecisionService();
    return service.getCurrent(session, applicationId);
  }
);

export const listHiringDecisionsCached = cache(
  async (session: SessionUser, applicationId: string) => {
    const service = createHiringDecisionService();
    return service.list(session, applicationId);
  }
);

export const getRequireDecisionForOfferCached = cache(async (): Promise<boolean> => {
  const settings = await prisma.recruitmentSettings.findUnique({
    where: { id: "default" },
    select: { requireDecisionForOffer: true },
  });
  return settings?.requireDecisionForOffer ?? true;
});
