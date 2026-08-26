"use server";

import { requireAdminSession } from "@/lib/auth-guards";
import { searchAuditLogs } from "@/lib/audit/audit-queries";

export async function exportAuditLogsAction(params: {
  q?: string;
  entityType?: string;
  action?: string;
}): Promise<{ csv: string } | { error: string }> {
  try {
    await requireAdminSession();
    const { rows } = await searchAuditLogs({
      ...params,
      page: 1,
      pageSize: 500,
    });

    const header = "id,createdAt,entityType,entityId,action,actorEmail,metadata";
    const lines = rows.map((r) => {
      const meta = JSON.stringify(r.metadata).replace(/"/g, '""');
      return [
        r.id,
        r.createdAt.toISOString(),
        r.entityType,
        r.entityId,
        r.action,
        r.actorEmail ?? "",
        `"${meta}"`,
      ].join(",");
    });

    return { csv: [header, ...lines].join("\n") };
  } catch {
    return { error: "Export failed." };
  }
}
