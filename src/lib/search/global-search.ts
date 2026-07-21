import { prisma } from "@/lib/prisma";
import { canAccessAdmin } from "@/lib/permissions";
import type { SessionUser } from "@/lib/session";

export type SearchResultItem = {
  id: string;
  type: "employee" | "leave" | "audit" | "page";
  title: string;
  subtitle: string;
  href: string;
  meta?: string;
};

export async function globalSearch(
  session: SessionUser,
  query: string,
  limit = 20
): Promise<SearchResultItem[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const results: SearchResultItem[] = [];
  const isAdmin = canAccessAdmin(session.role);

  const employees = await prisma.employee.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { employeeCode: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { department: { contains: q, mode: "insensitive" } },
      ],
    },
    take: 8,
    select: {
      id: true,
      name: true,
      employeeCode: true,
      department: true,
    },
  });

  for (const e of employees) {
    if (!isAdmin && session.employeeId !== e.id) continue;
    results.push({
      id: `emp-${e.id}`,
      type: "employee",
      title: e.name,
      subtitle: `${e.employeeCode}${e.department ? ` · ${e.department}` : ""}`,
      href: isAdmin ? `/admin/employees/${e.id}` : "/employee/dashboard",
    });
  }

  const textMatch = {
    OR: [
      { reason: { contains: q, mode: "insensitive" as const } },
      { employee: { name: { contains: q, mode: "insensitive" as const } } },
      { employee: { employeeCode: { contains: q, mode: "insensitive" as const } } },
    ],
  };
  // Non-admins see their own leaves plus their direct reports' (hierarchy-scoped).
  const scope = isAdmin
    ? {}
    : {
        OR: [
          { employeeId: session.employeeId ?? -1 },
          { employee: { managerId: session.employeeId ?? -1 } },
        ],
      };
  const leaveWhere = { AND: [textMatch, scope] };

  const leaves = await prisma.leaveRequest.findMany({
    where: leaveWhere,
    take: 8,
    orderBy: { createdAt: "desc" },
    include: { employee: { select: { name: true } } },
  });

  for (const l of leaves) {
    results.push({
      id: `leave-${l.id}`,
      type: "leave",
      title: `${l.employee.name} — ${l.leaveType}`,
      subtitle: l.workflowStatus.replace(/_/g, " "),
      href: isAdmin ? "/admin/leaves" : "/employee/leaves",
      meta: `${l.startDate.toISOString().slice(0, 10)}`,
    });
  }

  if (isAdmin) {
    const audits = await prisma.auditLog.findMany({
      where: {
        OR: [
          { action: { contains: q, mode: "insensitive" } },
          { entityId: { contains: q } },
          { actorEmail: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 5,
      orderBy: { createdAt: "desc" },
    });
    for (const a of audits) {
      results.push({
        id: `audit-${a.id}`,
        type: "audit",
        title: a.action,
        subtitle: `${a.entityType} / ${a.entityId}`,
        href: "/admin/audit",
      });
    }

    if ("approval".includes(q.toLowerCase()) || "leave".includes(q.toLowerCase())) {
      results.push({
        id: "page-leaves",
        type: "page",
        title: "Leave management",
        subtitle: "Admin",
        href: "/admin/leaves",
      });
    }
    if ("operation".includes(q.toLowerCase()) || "worker".includes(q.toLowerCase())) {
      results.push({
        id: "page-ops",
        type: "page",
        title: "Operations dashboard",
        subtitle: "Admin",
        href: "/admin/operations",
      });
    }
  }

  return results.slice(0, limit);
}
