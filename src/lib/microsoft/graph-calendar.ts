import { graphRequest } from "@/lib/microsoft/graph-client";
import type { GraphCalendarEvent } from "@/lib/microsoft/graph-types";

export async function createUserCalendarEvent(
  userPrincipalName: string,
  event: GraphCalendarEvent,
  correlationId?: string
) {
  return graphRequest<GraphCalendarEvent>(
    `/users/${encodeURIComponent(userPrincipalName)}/calendar/events`,
    { method: "POST", body: event, correlationId }
  );
}

export async function updateUserCalendarEvent(
  userPrincipalName: string,
  eventId: string,
  event: Partial<GraphCalendarEvent>,
  correlationId?: string
) {
  return graphRequest<GraphCalendarEvent>(
    `/users/${encodeURIComponent(userPrincipalName)}/calendar/events/${encodeURIComponent(eventId)}`,
    { method: "PATCH", body: event, correlationId }
  );
}

export async function deleteUserCalendarEvent(
  userPrincipalName: string,
  eventId: string,
  correlationId?: string
) {
  return graphRequest<void>(
    `/users/${encodeURIComponent(userPrincipalName)}/calendar/events/${encodeURIComponent(eventId)}`,
    { method: "DELETE", correlationId }
  );
}
