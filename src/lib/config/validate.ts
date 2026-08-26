import { getEnv, isProduction, isPostgresDatabase } from "@/lib/config/env";
import { hasExplicitAppBaseUrl } from "@/lib/config/app-url";

export type ConfigIssue = {
  field: string;
  level: "error" | "warning";
  message: string;
};

export type ConfigValidationResult = {
  ok: boolean;
  issues: ConfigIssue[];
};

function hasSmtpConfig(): boolean {
  return Boolean(getEnv("SMTP_HOST") && getEnv("EMAIL_FROM"));
}

function hasMicrosoftSso(): boolean {
  return Boolean(
    getEnv("AZURE_AD_CLIENT_ID") &&
      getEnv("AZURE_AD_CLIENT_SECRET") &&
      getEnv("AZURE_AD_TENANT_ID")
  );
}

function hasPartialMicrosoft(): boolean {
  const keys = ["AZURE_AD_CLIENT_ID", "AZURE_AD_CLIENT_SECRET", "AZURE_AD_TENANT_ID"] as const;
  const set = keys.filter((k) => getEnv(k));
  return set.length > 0 && set.length < keys.length;
}

export function validateApplicationConfig(opts?: {
  strict?: boolean;
}): ConfigValidationResult {
  const strict = opts?.strict ?? isProduction();
  const issues: ConfigIssue[] = [];

  if (!getEnv("AUTH_SECRET")) {
    issues.push({ field: "AUTH_SECRET", level: "error", message: "Required for session signing." });
  } else if ((getEnv("AUTH_SECRET") ?? "").length < 32) {
    issues.push({
      field: "AUTH_SECRET",
      level: strict ? "error" : "warning",
      message: "Should be at least 32 characters.",
    });
  }

  if (!getEnv("DATABASE_URL")) {
    issues.push({ field: "DATABASE_URL", level: "error", message: "PostgreSQL connection string required." });
  } else if (!isPostgresDatabase()) {
    issues.push({
      field: "DATABASE_URL",
      level: "error",
      message: "Must be a postgresql:// connection string (SQLite is no longer supported).",
    });
  }

  if (!hasExplicitAppBaseUrl()) {
    issues.push({
      field: "APP_BASE_URL",
      level: strict ? "error" : "warning",
      message: "Set APP_BASE_URL to your public HTTPS URL, or deploy on Vercel (uses VERCEL_URL).",
    });
  }

  if (!hasSmtpConfig()) {
    issues.push({
      field: "SMTP_HOST",
      level: "warning",
      message: "SMTP not configured; email notifications will fail.",
    });
  }

  if (hasPartialMicrosoft()) {
    issues.push({
      field: "AZURE_AD_*",
      level: "warning",
      message: "Microsoft SSO partially configured; set all AZURE_AD_* variables or none.",
    });
  }

  if (getEnv("TEAMS_WEBHOOK_URL") && !getEnv("TEAMS_WEBHOOK_URL")?.startsWith("http")) {
    issues.push({
      field: "TEAMS_WEBHOOK_URL",
      level: "warning",
      message: "Teams webhook URL should be an HTTPS URL.",
    });
  }

  if (strict && isProduction()) {
    if (!getEnv("NOTIFICATION_CRON_SECRET") && !getEnv("INTEGRATION_CRON_SECRET")) {
      issues.push({
        field: "NOTIFICATION_CRON_SECRET",
        level: "warning",
        message: "Cron secrets recommended for worker HTTP triggers in production.",
      });
    }
  }

  const errors = issues.filter((i) => i.level === "error");
  return { ok: errors.length === 0, issues };
}

export function assertValidConfig(opts?: { strict?: boolean }): void {
  const result = validateApplicationConfig(opts);
  if (!result.ok) {
    const msg = result.issues
      .filter((i) => i.level === "error")
      .map((i) => `${i.field}: ${i.message}`)
      .join("; ");
    throw new Error(`Configuration validation failed: ${msg}`);
  }
}
