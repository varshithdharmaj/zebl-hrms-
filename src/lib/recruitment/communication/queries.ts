import { cache } from "react";
import type { SessionUser } from "@/lib/session";
import { createCommunicationService } from "@/lib/recruitment/services/communication-service";
import type {
  ListCommunicationsInput,
  SearchCommunicationsInput,
} from "@/lib/validation/schemas/recruitment/communications";

export const getCommunicationCached = cache(
  async (session: SessionUser, id: string) => {
    const service = createCommunicationService();
    return service.getCommunication(session, id);
  }
);

export const listCommunicationsCached = cache(
  async (session: SessionUser, input?: ListCommunicationsInput) => {
    const service = createCommunicationService();
    return service.listCommunications(session, input);
  }
);

export const searchCommunicationsCached = cache(
  async (session: SessionUser, input: SearchCommunicationsInput) => {
    const service = createCommunicationService();
    return service.searchCommunications(session, input);
  }
);

export const getCommunicationThreadCached = cache(
  async (session: SessionUser, threadId: string) => {
    const service = createCommunicationService();
    return service.getThread(session, threadId);
  }
);

export const getCommunicationDashboardStatsCached = cache(
  async (session: SessionUser) => {
    const service = createCommunicationService();
    return service.getDashboardStats(session);
  }
);

export const listEmailTemplatesCached = cache(async (session: SessionUser) => {
  const service = createCommunicationService();
  return service.listEmailTemplates(session);
});

export const listCommunicationAttachmentsCached = cache(
  async (session: SessionUser, communicationId: string) => {
    const service = createCommunicationService();
    return service.listAttachments(session, communicationId);
  }
);

export const getCommunicationAttachmentCached = cache(
  async (session: SessionUser, id: string) => {
    const service = createCommunicationService();
    return service.getAttachment(session, id);
  }
);

export const listTemplatesAdminCached = cache(
  async (
    session: SessionUser,
    input?: Parameters<
      ReturnType<typeof createCommunicationService>["listTemplatesAdmin"]
    >[1]
  ) => {
    const service = createCommunicationService();
    return service.listTemplatesAdmin(session, input);
  }
);

export const listScheduledQueueCached = cache(
  async (
    session: SessionUser,
    input?: { page?: number; pageSize?: number; candidateId?: string }
  ) => {
    const service = createCommunicationService();
    return service.listScheduledQueue(session, input);
  }
);

export const getCommunicationAnalyticsCached = cache(
  async (session: SessionUser) => {
    const service = createCommunicationService();
    return service.getCommunicationAnalytics(session);
  }
);
