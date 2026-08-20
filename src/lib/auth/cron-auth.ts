import { timingSafeEqual } from "node:crypto";
import { getSession } from "@/lib/auth";
import { sessionRequiresPasswordChange } from "@/lib/auth/password-change-gate";
import { canAccessAdmin } from "@/lib/permissions";
import { getEnv } from "@/lib/config/env";

function secretsMatch(bearer: string, secret: string): boolean {
  const a = Buffer.from(bearer);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function nonEmptySecrets(secrets: (string | undefined)[]): string[] {
  return secrets.filter((s): s is string => Boolean(s && s.length > 0));
}

/**
 * Authorize a cron/worker HTTP trigger.
 * Empty configured secrets never match. Missing/invalid Bearer is rejected
 * unless an HR/SA session (without a pending password change) is present.
 */
export async function authorizeCronOrAdmin(
  request: Request,
  secrets: (string | undefined)[]
): Promise<boolean> {
  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  const validSecrets = nonEmptySecrets(secrets);

  if (bearer && validSecrets.length > 0 && validSecrets.some((s) => secretsMatch(bearer, s))) {
    return true;
  }

  const session = await getSession();
  if (!session || !canAccessAdmin(session.role)) return false;
  if (sessionRequiresPasswordChange(session)) return false;
  return true;
}

export function getCronSecrets(): {
  notification: string | undefined;
  integration: string | undefined;
  analytics: string | undefined;
  attendanceBridge: string | undefined;
} {
  const integration = getEnv("INTEGRATION_CRON_SECRET");
  return {
    notification: getEnv("NOTIFICATION_CRON_SECRET"),
    integration,
    analytics: getEnv("ANALYTICS_CRON_SECRET") ?? integration,
    attendanceBridge: getEnv("ATTENDANCE_BRIDGE_SECRET") ?? integration,
  };
}
