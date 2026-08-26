import { prisma } from "@/lib/prisma";

export type AuditLogRow = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actorUserId: string | null;
  actorEmail: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
};

function parseMetadata(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* ignore */
  }
  return {};
}

export async function searchAuditLogs(params: {
  q?: string;
  entityType?: string;
  action?: string;
  actorEmail?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
}): Promise<{ rows: AuditLogRow[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, params.pageSize ?? 50));
  const skip = (page - 1) * pageSize;

  const where = {
    ...(params.entityType ? { entityType: params.entityType } : {}),
    ...(params.action ? { action: { contains: params.action } } : {}),
    ...(params.actorEmail
      ? { actorEmail: { contains: params.actorEmail, mode: "insensitive" as const } }
      : {}),
    ...(params.from || params.to
      ? {
          createdAt: {
            ...(params.from ? { gte: params.from } : {}),
            ...(params.to ? { lte: params.to } : {}),
          },
        }
      : {}),
    ...(params.q
      ? {
          OR: [
            { entityId: { contains: params.q } },
            { action: { contains: params.q, mode: "insensitive" as const } },
            { actorEmail: { contains: params.q, mode: "insensitive" as const } },
            { metadata: { contains: params.q } },
          ],
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
  ]);

  return {
    total,
    page,
    pageSize,
    rows: rows.map((row) => ({
      id: row.id,
      entityType: row.entityType,
      entityId: row.entityId,
      action: row.action,
      actorUserId: row.actorUserId,
      actorEmail: row.actorEmail,
      metadata: parseMetadata(row.metadata),
      createdAt: row.createdAt,
    })),
  };
}

export async function getAuditFilterOptions() {
  const [entityTypes, actions] = await Promise.all([
    prisma.auditLog.findMany({
      distinct: ["entityType"],
      select: { entityType: true },
      orderBy: { entityType: "asc" },
      take: 50,
    }),
    prisma.auditLog.findMany({
      distinct: ["action"],
      select: { action: true },
      orderBy: { action: "asc" },
      take: 100,
    }),
  ]);
  return {
    entityTypes: entityTypes.map((e) => e.entityType),
    actions: actions.map((a) => a.action),
  };
}
