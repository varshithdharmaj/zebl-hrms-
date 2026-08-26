import { prisma } from "@/lib/prisma";
import { SectionCard } from "@/components/ui/section-card";
import { formatDate } from "@/lib/utils";

export async function CalendarSyncStatusPanel() {
  const rows = await prisma.leaveRequest.findMany({
    where: {
      calendarSyncStatus: { in: ["synced", "failed", "pending"] },
      workflowStatus: { in: ["approved", "cancelled"] },
    },
    orderBy: { calendarLastSyncedAt: "desc" },
    take: 8,
    include: { employee: { select: { name: true, employeeCode: true } } },
  });

  return (
    <SectionCard title="Calendar sync diagnostics" description="Recent Outlook calendar operations">
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No calendar sync activity yet.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
            >
              <span>
                {row.employee.name} — {row.leaveType} ({row.calendarSyncStatus})
              </span>
              <span className="text-xs text-muted-foreground">
                {row.calendarLastSyncedAt
                  ? formatDate(row.calendarLastSyncedAt)
                  : "—"}
                {row.externalCalendarEventId
                  ? ` · event ${row.externalCalendarEventId.slice(0, 8)}…`
                  : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
