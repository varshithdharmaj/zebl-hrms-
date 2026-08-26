import { graphRequest } from "@/lib/microsoft/graph-client";
import type { GraphPresence } from "@/lib/microsoft/graph-types";

export async function getUserPresence(azureUserId: string): Promise<GraphPresence | null> {
  const result = await graphRequest<GraphPresence>(
    `/users/${encodeURIComponent(azureUserId)}/presence`
  );
  return result.ok ? result.data : null;
}

export async function getBulkPresence(
  azureUserIds: string[]
): Promise<GraphPresence[]> {
  if (azureUserIds.length === 0) return [];
  const result = await graphRequest<{ value: GraphPresence[] }>("/communications/getPresencesByUserId", {
    method: "POST",
    body: { ids: azureUserIds.slice(0, 650) },
  });
  return result.ok ? (result.data.value ?? []) : [];
}

/** Foundation for presence-aware escalation — does not auto-reroute approvals. */
export function isPresenceLikelyUnavailable(presence: GraphPresence | null): boolean {
  if (!presence?.availability) return false;
  const unavailable = ["Offline", "Away", "DoNotDisturb", "Busy"];
  return unavailable.includes(presence.availability);
}
