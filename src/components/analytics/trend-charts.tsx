import type { ExecutiveDashboardPayload } from "@/lib/analytics/analytics-types";

export function DepartmentComparisonChart({
  data,
}: {
  data: ExecutiveDashboardPayload["departmentComparison"];
}) {
  const max = Math.max(...data.map((d) => d.attendanceRate), 1);

  return (
    <div className="space-y-3">
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No department data in snapshot.</p>
      ) : (
        data.map((d) => (
          <div key={d.department}>
            <div className="mb-1 flex justify-between text-xs">
              <span className="font-medium">{d.department}</span>
              <span className="text-muted-foreground">{d.attendanceRate}% attendance</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${(d.attendanceRate / max) * 100}%` }}
              />
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export function BottleneckPanel({
  bottlenecks,
}: {
  bottlenecks: ExecutiveDashboardPayload["bottlenecks"];
}) {
  return (
    <div className="space-y-3 text-sm">
      <p>
        <span className="font-medium">Stuck workflows:</span> {bottlenecks.stuckWorkflows}
      </p>
      <p>
        <span className="font-medium">Escalations:</span> {bottlenecks.escalationCount}
      </p>
      {bottlenecks.slowApprovers.length > 0 ? (
        <ul className="list-disc pl-5 text-muted-foreground">
          {bottlenecks.slowApprovers.map((m) => (
            <li key={m.managerId}>
              {m.name} — avg {m.avgHours}h turnaround
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">No slow approver outliers detected.</p>
      )}
    </div>
  );
}
