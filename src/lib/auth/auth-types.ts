import type { AuthProvider } from "@prisma/client";
import type { SessionUser } from "@/lib/session";

export type { SessionUser };

export type IdentityProviderId = "local" | "microsoft";

export type AuthResult =
  | { ok: true; user: SessionUser }
  | { ok: false; code: AuthErrorCode; message: string };

export type AuthErrorCode =
  | "invalid_credentials"
  | "inactive_employee"
  | "rate_limited"
  | "sso_disabled"
  | "sso_denied"
  | "account_conflict"
  | "unknown_user"
  | "tenant_mismatch"
  | "invalid_token"
  | "service_unavailable";

export type MicrosoftIdTokenClaims = {
  sub: string;
  oid?: string;
  tid?: string;
  email?: string;
  preferred_username?: string;
  name?: string;
  picture?: string;
  roles?: string[];
  groups?: string[];
};

export type ProvisionMicrosoftInput = {
  claims: MicrosoftIdTokenClaims;
  tenantId: string;
  correlationId: string;
};

export type ProvisionMicrosoftResult =
  | { ok: true; userId: string; linked: boolean; created: boolean }
  | { ok: false; code: AuthErrorCode; message: string };

export type EstablishSessionInput = {
  userId: string;
  authProvider: AuthProvider;
  clientIp?: string;
  correlationId?: string;
};
