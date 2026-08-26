import { getAppBaseUrl, hasExplicitAppBaseUrl } from "@/lib/config/app-url";

export { getAppBaseUrl } from "@/lib/config/app-url";

export type MicrosoftAuthConfig = {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  redirectUri: string;
  issuerUrl: URL;
};

export type GraphPlaceholderConfig = {
  clientId?: string;
  clientSecret?: string;
};

function read(name: string): string | undefined {
  const v = process.env[name];
  return v?.trim() || undefined;
}

export function isMicrosoftAuthEnabled(): boolean {
  return Boolean(getMicrosoftAuthConfig());
}

export function getMicrosoftAuthConfig(): MicrosoftAuthConfig | null {
  const clientId = read("AZURE_AD_CLIENT_ID");
  const clientSecret = read("AZURE_AD_CLIENT_SECRET");
  const tenantId = read("AZURE_AD_TENANT_ID");
  const redirectUri =
    read("AZURE_AD_REDIRECT_URI") ?? `${getAppBaseUrl()}/api/auth/microsoft/callback`;

  if (!clientId || !clientSecret || !tenantId) return null;

  return {
    clientId,
    clientSecret,
    tenantId,
    redirectUri,
    issuerUrl: new URL(`https://login.microsoftonline.com/${tenantId}/v2.0`),
  };
}

export function getGraphPlaceholderConfig(): GraphPlaceholderConfig {
  return {
    clientId: read("GRAPH_CLIENT_ID"),
    clientSecret: read("GRAPH_CLIENT_SECRET"),
  };
}

export function isSsoAutoProvisionEnabled(): boolean {
  return read("AUTH_SSO_AUTO_PROVISION") === "true";
}

export function isSsoAutoLinkEnabled(): boolean {
  const v = read("AUTH_SSO_AUTO_LINK");
  return v !== "false";
}

type ValidationIssue = { field: string; message: string };

export function validateAuthEnvironment(options?: { strict?: boolean }): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const strict = options?.strict ?? process.env.NODE_ENV === "production";

  if (!read("AUTH_SECRET")) {
    issues.push({ field: "AUTH_SECRET", message: "Required for session signing." });
  }
  if (!read("DATABASE_URL")) {
    issues.push({ field: "DATABASE_URL", message: "Required for database access." });
  }
  if (!hasExplicitAppBaseUrl() && strict) {
    issues.push({
      field: "APP_BASE_URL",
      message: "Set APP_BASE_URL or deploy on Vercel (VERCEL_URL is used automatically).",
    });
  }

  const azurePartial = [
    "AZURE_AD_CLIENT_ID",
    "AZURE_AD_CLIENT_SECRET",
    "AZURE_AD_TENANT_ID",
  ].filter((k) => read(k));
  if (azurePartial.length > 0 && azurePartial.length < 3) {
    issues.push({
      field: "AZURE_AD_*",
      message: "Set AZURE_AD_CLIENT_ID, AZURE_AD_CLIENT_SECRET, and AZURE_AD_TENANT_ID together.",
    });
  }

  return issues;
}

export function assertAuthEnvironment(): void {
  const issues = validateAuthEnvironment({ strict: true });
  if (issues.length > 0) {
    const msg = issues.map((i) => `${i.field}: ${i.message}`).join("; ");
    throw new Error(`Auth environment invalid: ${msg}`);
  }
}
