import { AuthProvider } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AUDIT_ACTIONS, writeAuditLog } from "@/lib/audit";
import {
  isSsoAutoLinkEnabled,
  isSsoAutoProvisionEnabled,
} from "@/lib/auth/auth-config";
import type { MicrosoftIdTokenClaims, ProvisionMicrosoftInput, ProvisionMicrosoftResult } from "@/lib/auth/auth-types";
import { resolveRoleForMicrosoftSignIn } from "@/lib/auth/role-mapping";

export function normalizeAuthEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function extractEmailFromClaims(claims: MicrosoftIdTokenClaims): string | null {
  const raw = claims.email ?? claims.preferred_username;
  if (!raw || typeof raw !== "string") return null;
  return normalizeAuthEmail(raw);
}

export function extractAzureOid(claims: MicrosoftIdTokenClaims): string {
  return (claims.oid ?? claims.sub) as string;
}

function serializeAuthMetadata(claims: MicrosoftIdTokenClaims, correlationId: string): string {
  return JSON.stringify({
    name: claims.name,
    correlationId,
    linkedAt: new Date().toISOString(),
  });
}

async function findEmployeeByEmail(email: string) {
  return prisma.employee.findFirst({
    where: {
      email: { equals: email },
      isActive: true,
      employeeStatus: "Active",
    },
  });
}

export async function provisionMicrosoftUser(
  input: ProvisionMicrosoftInput
): Promise<ProvisionMicrosoftResult> {
  const email = extractEmailFromClaims(input.claims);
  if (!email) {
    return {
      ok: false,
      code: "sso_denied",
      message: "Microsoft account did not include a verified work email.",
    };
  }

  const oid = extractAzureOid(input.claims);
  if (!oid) {
    return { ok: false, code: "invalid_token", message: "Invalid Microsoft identity token." };
  }

  if (input.claims.tid && input.claims.tid !== input.tenantId) {
    return {
      ok: false,
      code: "tenant_mismatch",
      message: "Microsoft tenant is not authorized for this application.",
    };
  }

  const oidOwner = await prisma.user.findUnique({ where: { azureOid: oid } });
  if (oidOwner && oidOwner.email !== email) {
    return {
      ok: false,
      code: "account_conflict",
      message: "This Microsoft account is already linked to another user.",
    };
  }

  let user = await prisma.user.findUnique({
    where: { email },
    include: { employee: true },
  });

  let linked = false;
  let created = false;

  if (!user) {
    const employee = await findEmployeeByEmail(email);
    if (!employee) {
      return {
        ok: false,
        code: "unknown_user",
        message:
          "No AMS account found for this email. Contact HR to provision your access before signing in with Microsoft.",
      };
    }

    if (!isSsoAutoProvisionEnabled()) {
      return {
        ok: false,
        code: "unknown_user",
        message:
          "Your employee record exists but no AMS login is provisioned. Contact HR to enable your account.",
      };
    }

    const role = resolveRoleForMicrosoftSignIn({ existingRole: null, claims: input.claims });
    user = await prisma.user.create({
      data: {
        email,
        role,
        authProvider: AuthProvider.microsoft,
        azureOid: oid,
        microsoftTenantId: input.tenantId,
        employeeId: employee.id,
        profilePhotoUrl: input.claims.picture ?? null,
        authMetadata: serializeAuthMetadata(input.claims, input.correlationId),
        lastLoginAt: new Date(),
      },
      include: { employee: true },
    });
    created = true;
    return { ok: true, userId: user.id, linked: false, created: true };
  }

  if (user.azureOid && user.azureOid !== oid) {
    return {
      ok: false,
      code: "account_conflict",
      message: "This email is linked to a different Microsoft account.",
    };
  }

  const otherOid = await prisma.user.findFirst({
    where: { azureOid: oid, id: { not: user.id } },
  });
  if (otherOid) {
    return {
      ok: false,
      code: "account_conflict",
      message: "This Microsoft account is already linked to another AMS user.",
    };
  }

  const employee = await findEmployeeByEmail(email);
  const willLinkMicrosoft = !user.azureOid && isSsoAutoLinkEnabled();
  const willLinkEmployee = !user.employeeId && !!employee;

  user = await prisma.user.update({
    where: { id: user.id },
    data: {
      lastLoginAt: new Date(),
      microsoftTenantId: input.tenantId,
      profilePhotoUrl: input.claims.picture ?? user.profilePhotoUrl,
      authMetadata: serializeAuthMetadata(input.claims, input.correlationId),
      ...(willLinkMicrosoft
        ? { azureOid: oid, authProvider: AuthProvider.microsoft }
        : {}),
      ...(willLinkEmployee && employee ? { employeeId: employee.id } : {}),
    },
    include: { employee: true },
  });

  linked = willLinkMicrosoft || willLinkEmployee;
  if (linked) {
    await writeAuditLog({
      entityType: "user",
      entityId: user.id,
      action: AUDIT_ACTIONS.AUTH_SSO_ACCOUNT_LINKED,
      actorUserId: user.id,
      actorEmail: user.email,
      metadata: {
        azureOid: oid,
        correlationId: input.correlationId,
        linkedMicrosoft: willLinkMicrosoft,
        linkedEmployee: willLinkEmployee,
      },
    });
  }

  if (!user.isActive) {
    return {
      ok: false,
      code: "inactive_employee",
      message: "Your account has been deactivated. Contact your administrator.",
    };
  }

  if (
    user.employee &&
    (user.employee.employeeStatus !== "Active" || !user.employee.isActive)
  ) {
    return {
      ok: false,
      code: "inactive_employee",
      message: "Your employee account is inactive. Contact HR.",
    };
  }

  return { ok: true, userId: user.id, linked, created };
}
