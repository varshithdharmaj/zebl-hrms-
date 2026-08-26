import { graphRequest } from "@/lib/microsoft/graph-client";
import type { GraphUser } from "@/lib/microsoft/graph-types";

export async function getUserByEmail(email: string): Promise<GraphUser | null> {
  const result = await graphRequest<GraphUser>(
    `/users/${encodeURIComponent(email)}?$select=id,displayName,mail,userPrincipalName,jobTitle,department`
  );
  return result.ok ? result.data : null;
}

export async function listUsersPage(nextLink?: string): Promise<{
  users: GraphUser[];
  nextLink?: string;
}> {
  const path =
    nextLink ??
    `/users?$select=id,displayName,mail,userPrincipalName,jobTitle,department&$top=50`;
  const result = await graphRequest<{ value: GraphUser[]; "@odata.nextLink"?: string }>(path);
  if (!result.ok) return { users: [] };
  return {
    users: result.data.value ?? [],
    nextLink: result.data["@odata.nextLink"],
  };
}

export async function getUserPhotoUrl(userId: string): Promise<string | null> {
  const result = await graphRequest<Blob>(`/users/${userId}/photo/$value`);
  if (!result.ok) return null;
  return null;
}
