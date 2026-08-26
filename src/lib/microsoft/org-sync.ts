import { prisma } from "@/lib/prisma";
import { AUDIT_ACTIONS, writeAuditLog } from "@/lib/audit";
import { isGraphConfigured } from "@/lib/microsoft/graph-auth";
import { listUsersPage } from "@/lib/microsoft/graph-users";
import { getIntegrationSettings } from "@/lib/integrations/integration-settings";
import type { OrgSyncPolicy } from "@/lib/microsoft/graph-types";

function parseOrgSyncPolicy(raw: string): OrgSyncPolicy {
  try {
    return JSON.parse(raw) as OrgSyncPolicy;
  } catch {
    return {};
  }
}

function normalizeEmail(email: string | undefined | null): string | null {
  if (!email) return null;
  return email.trim().toLowerCase();
}

export async function runOrganizationSync(correlationId: string): Promise<{
  matched: number;
  updated: number;
  skipped: number;
}> {
  if (!isGraphConfigured()) {
    return { matched: 0, updated: 0, skipped: 0 };
  }

  const settings = await getIntegrationSettings();
  if (!settings.orgSyncEnabled) {
    return { matched: 0, updated: 0, skipped: 0 };
  }

  const policy = parseOrgSyncPolicy(settings.orgSyncPolicy);
  let matched = 0;
  let updated = 0;
  let skipped = 0;
  let nextLink: string | undefined;

  do {
    const page = await listUsersPage(nextLink);
    nextLink = page.nextLink;

    for (const graphUser of page.users) {
      const email = normalizeEmail(graphUser.mail ?? graphUser.userPrincipalName);
      if (!email) {
        skipped += 1;
        continue;
      }

      const employee = await prisma.employee.findFirst({
        where: { email: { equals: email } },
        include: { user: true },
      });
      if (!employee) {
        skipped += 1;
        continue;
      }

      matched += 1;
      const data: Record<string, unknown> = {
        externalProfileSyncedAt: new Date(),
      };

      if (policy.syncDepartment && graphUser.department) {
        if (policy.overwriteLocal || !employee.department) {
          data.department = graphUser.department;
        }
      }
      if (policy.syncDesignation && graphUser.jobTitle) {
        if (policy.overwriteLocal || !employee.designation) {
          data.designation = graphUser.jobTitle;
        }
      }

      if (Object.keys(data).length > 1) {
        await prisma.employee.update({ where: { id: employee.id }, data });
        updated += 1;
      }

      if (policy.syncPhoto && employee.user && graphUser.id) {
        await prisma.user.update({
          where: { id: employee.user.id },
          data: {
            profilePhotoUrl: `https://graph.microsoft.com/v1.0/users/${graphUser.id}/photo/$value`,
          },
        });
      }

      if (policy.syncManager && graphUser.manager?.id) {
        // Foundation only — manager mapping requires directory lookup; skip auto-write
      }
    }
  } while (nextLink);

  await writeAuditLog({
    entityType: "integration",
    entityId: "org-sync",
    action: AUDIT_ACTIONS.ORG_SYNC_COMPLETED,
    metadata: { correlationId, matched, updated, skipped },
  });

  return { matched, updated, skipped };
}
