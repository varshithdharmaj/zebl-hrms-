import { getSession } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/permissions";
import { getEnv } from "@/lib/config/env";

export async function authorizeCronOrAdmin(
  request: Request,
  secrets: (string | undefined)[]
): Promise<boolean> {
  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const validSecrets = secrets.filter(Boolean) as string[];
  if (bearer && validSecrets.some((s) => s === bearer)) return true;

  const session = await getSession();
  return Boolean(session && canAccessAdmin(session.role));
}

export function getCronSecrets(): {
  notification: string | undefined;
  integration: string | undefined;
  analytics: string | undefined;
} {
  const integration = getEnv("INTEGRATION_CRON_SECRET");
  return {
    notification: getEnv("NOTIFICATION_CRON_SECRET"),
    integration,
    analytics: getEnv("ANALYTICS_CRON_SECRET") ?? integration,
  };
}
