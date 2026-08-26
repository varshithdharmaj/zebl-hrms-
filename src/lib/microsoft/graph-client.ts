import { getMicrosoftAuthConfig, getGraphPlaceholderConfig } from "@/lib/auth/auth-config";
import { getGraphAccessToken } from "@/lib/microsoft/graph-auth";
import type {
  GraphClientConfig,
  GraphRequestOptions,
  GraphRequestResult,
  GraphScope,
} from "@/lib/microsoft/graph-types";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const MAX_RETRIES = 3;

export function getGraphClientConfig(
  scopes: GraphScope[] = ["User.Read.All", "Calendars.ReadWrite", "Presence.Read.All"]
): GraphClientConfig | null {
  const azure = getMicrosoftAuthConfig();
  const graph = getGraphPlaceholderConfig();
  const clientId = graph.clientId ?? azure?.clientId;
  const clientSecret = graph.clientSecret ?? azure?.clientSecret;
  const tenantId = azure?.tenantId;
  if (!clientId || !clientSecret || !tenantId) return null;
  return { tenantId, clientId, clientSecret, scopes };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function graphRequest<T>(
  path: string,
  options: GraphRequestOptions = {}
): Promise<GraphRequestResult<T>> {
  const token = options.accessToken ?? (await getGraphAccessToken());
  if (!token) {
    return { ok: false, error: "Graph API is not configured", status: 0 };
  }

  const url = path.startsWith("http") ? path : `${GRAPH_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  let attempt = 0;
  let backoff = 1000;

  while (attempt < MAX_RETRIES) {
    attempt += 1;
    try {
      const res = await fetch(url, {
        method: options.method ?? "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...(options.correlationId ? { "client-request-id": options.correlationId } : {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      if (res.status === 429 || res.status === 503) {
        const retryAfter = parseInt(res.headers.get("Retry-After") ?? "0", 10) * 1000;
        await sleep(retryAfter > 0 ? retryAfter : backoff);
        backoff = Math.min(backoff * 2, 30_000);
        continue;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return {
          ok: false,
          error: text.slice(0, 500) || res.statusText,
          status: res.status,
        };
      }

      if (res.status === 204) {
        return { ok: true, data: undefined as T, status: 204 };
      }

      const data = (await res.json()) as T;
      return { ok: true, data, status: res.status };
    } catch (e) {
      if (attempt >= MAX_RETRIES) {
        return {
          ok: false,
          error: e instanceof Error ? e.message : "Graph request failed",
          status: 0,
        };
      }
      await sleep(backoff);
      backoff = Math.min(backoff * 2, 30_000);
    }
  }

  return { ok: false, error: "Graph request exceeded retries", status: 0 };
}

export async function checkGraphHealth(): Promise<{ ok: boolean; message: string }> {
  const result = await graphRequest<{ value: unknown[] }>("/organization?$select=id,displayName");
  if (result.ok) return { ok: true, message: "Graph API reachable" };
  return { ok: false, message: result.error };
}
