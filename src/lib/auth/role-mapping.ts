import type { UserRole } from "@prisma/client";
import type { MicrosoftIdTokenClaims } from "@/lib/auth/auth-types";
import { parseAppUserRole, type AppUserRole } from "@/lib/roles";

export type RoleMappingConfig = {
  /** Azure AD group object IDs mapped to AMS roles */
  groupToRole: Record<string, AppUserRole>;
  /** App roles from token `roles` claim */
  appRoleToRole: Record<string, AppUserRole>;
};

function parseJsonMapping(raw: string | undefined): Record<string, AppUserRole> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    const out: Record<string, AppUserRole> = {};
    for (const [key, value] of Object.entries(parsed)) {
      const role = parseAppUserRole(value);
      // SSO must never grant Super Admin. Any mapping that resolves to super_admin is
      // downgraded to hr — the highest privilege SSO is allowed to auto-assign.
      if (!role) continue;
      out[key] = role === "super_admin" ? "hr" : role;
    }
    return out;
  } catch {
    return {};
  }
}

export function loadRoleMappingConfig(): RoleMappingConfig {
  return {
    groupToRole: parseJsonMapping(process.env.AZURE_AD_GROUP_ROLE_MAP),
    appRoleToRole: parseJsonMapping(process.env.AZURE_AD_APP_ROLE_MAP),
  };
}

/**
 * Resolve role for SSO sign-in.
 * Priority: existing AMS role → Microsoft groups/app roles → employee default.
 */
export function resolveRoleForMicrosoftSignIn(params: {
  existingRole: UserRole | null;
  claims: MicrosoftIdTokenClaims;
  mapping?: RoleMappingConfig;
}): AppUserRole {
  if (params.existingRole) {
    return params.existingRole as AppUserRole;
  }

  const mapping = params.mapping ?? loadRoleMappingConfig();
  const groups = params.claims.groups ?? [];
  for (const groupId of groups) {
    const mapped = mapping.groupToRole[groupId];
    if (mapped) return mapped;
  }

  const roles = params.claims.roles ?? [];
  for (const appRole of roles) {
    const mapped = mapping.appRoleToRole[appRole];
    if (mapped) return mapped;
  }

  return "employee";
}
