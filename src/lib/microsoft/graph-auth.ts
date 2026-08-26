import { getGraphClientConfig } from "@/lib/microsoft/graph-client";
import type { GraphTokenResponse } from "@/lib/microsoft/graph-types";

const GRAPH_TOKEN_URL = "https://login.microsoftonline.com";
const GRAPH_SCOPE = "https://graph.microsoft.com/.default";

type CachedToken = {
  accessToken: string;
  expiresAt: number;
};

let cachedAppToken: CachedToken | null = null;

export function isGraphConfigured(): boolean {
  return getGraphClientConfig() !== null;
}

export async function getGraphAccessToken(forceRefresh = false): Promise<string | null> {
  const config = getGraphClientConfig();
  if (!config?.clientSecret) return null;

  const now = Date.now();
  if (!forceRefresh && cachedAppToken && cachedAppToken.expiresAt > now + 60_000) {
    return cachedAppToken.accessToken;
  }

  const tokenUrl = `${GRAPH_TOKEN_URL}/${config.tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scope: GRAPH_SCOPE,
    grant_type: "client_credentials",
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    cachedAppToken = null;
    return null;
  }

  const json = (await res.json()) as GraphTokenResponse;
  cachedAppToken = {
    accessToken: json.access_token,
    expiresAt: now + json.expires_in * 1000,
  };
  return json.access_token;
}

export function clearGraphTokenCache(): void {
  cachedAppToken = null;
}
