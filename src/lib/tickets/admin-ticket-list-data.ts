import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/** Scalar ticket fields needed before relation hydration (FK ids included). */
export function getAdminTicketListScalarSelect() {
  return {
    id: true,
    ticketNumber: true,
    subject: true,
    category: true,
    priority: true,
    status: true,
    isAnonymous: true,
    department: true,
    assignedToUserId: true,
    raisedByEmployeeId: true,
    updatedAt: true,
    createdAt: true,
  } as const satisfies Prisma.TicketSelect;
}

export type AdminTicketListScalar = Prisma.TicketGetPayload<{
  select: ReturnType<typeof getAdminTicketListScalarSelect>;
}>;

/** UI contract for HR / anonymous ticket list rows (matches prior nested select). */
export type AdminTicketListRow = AdminTicketListScalar & {
  assignedToUser: {
    id: string;
    email: string;
    employee: { name: string } | null;
  } | null;
  raisedByEmployee: {
    id: number;
    name: string;
    employeeCode: string;
  };
};

/**
 * Hydrate assignee + raised-by after a scalar ticket list query.
 *
 * Ticket nested `select` issues sequential follow-ups (tickets → users → employees).
 * Loading scalars first, then:
 *   - users(+employee) for assignees — single JOIN statement
 *   - employees for raised-by ids
 * in parallel collapses relation depth from ~2 sequential RTTs to ~1.
 *
 * Only called with tickets already authorized by the list WHERE clause.
 */
export async function hydrateAdminTicketListRelations(
  tickets: AdminTicketListScalar[]
): Promise<AdminTicketListRow[]> {
  if (tickets.length === 0) return [];

  const assignedIds = [
    ...new Set(
      tickets.map((t) => t.assignedToUserId).filter((id): id is string => Boolean(id))
    ),
  ];
  const raisedIds = [...new Set(tickets.map((t) => t.raisedByEmployeeId))];

  const [assignees, raisers] = await Promise.all([
    assignedIds.length > 0
      ? prisma.user.findMany({
          where: { id: { in: assignedIds } },
          select: {
            id: true,
            email: true,
            employee: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
    prisma.employee.findMany({
      where: { id: { in: raisedIds } },
      select: { id: true, name: true, employeeCode: true },
    }),
  ]);

  const assigneeById = new Map(assignees.map((u) => [u.id, u]));
  const raiserById = new Map(raisers.map((e) => [e.id, e]));

  return tickets.map((ticket) => {
    const raiser = raiserById.get(ticket.raisedByEmployeeId);
    if (!raiser) {
      // Required FK — should always exist; fail closed rather than fabricate.
      throw new Error(
        `Missing raisedByEmployee ${ticket.raisedByEmployeeId} for ticket ${ticket.id}`
      );
    }

    const assignee = ticket.assignedToUserId
      ? assigneeById.get(ticket.assignedToUserId) ?? null
      : null;

    return {
      ...ticket,
      assignedToUser: assignee
        ? {
            id: assignee.id,
            email: assignee.email,
            employee: assignee.employee,
          }
        : null,
      raisedByEmployee: {
        id: raiser.id,
        name: raiser.name,
        employeeCode: raiser.employeeCode,
      },
    };
  });
}

/**
 * Admin `/admin/tickets` list + pagination count + status/priority stats.
 *
 * - `whereClause`: filtered list scope (pagination count + rows)
 * - `statsWhere`: unfiltered authorization scope (KPIs)
 *
 * Wave 1: scalar list ∥ count ∥ status ∥ priority (independent).
 * Wave 2: assignee users ∥ raised-by employees (parallel hydration).
 */
export async function fetchAdminTicketListPageData(params: {
  whereClause: Prisma.TicketWhereInput;
  statsWhere: Prisma.TicketWhereInput;
  skip: number;
  take: number;
}) {
  const { whereClause, statsWhere, skip, take } = params;

  const [ticketScalars, totalCount, stats, priorityStats] = await Promise.all([
    prisma.ticket.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: getAdminTicketListScalarSelect(),
    }),
    prisma.ticket.count({ where: whereClause }),
    prisma.ticket.groupBy({
      by: ["status"],
      where: statsWhere,
      _count: true,
    }),
    prisma.ticket.groupBy({
      by: ["priority"],
      where: statsWhere,
      _count: true,
    }),
  ]);

  const tickets = await hydrateAdminTicketListRelations(ticketScalars);

  return { tickets, totalCount, stats, priorityStats };
}
