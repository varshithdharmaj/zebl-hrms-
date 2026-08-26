import { getNotificationCenterItems } from "@/lib/notifications/notification-center";
import { jsonOk, withAuthenticatedApi } from "@/lib/errors/handle-api";

export const GET = withAuthenticatedApi(async (_request, { correlationId, session }) => {
  const items = await getNotificationCenterItems(session);
  return jsonOk({ items }, correlationId);
});
