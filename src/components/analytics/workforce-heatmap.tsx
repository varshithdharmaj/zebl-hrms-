import type { ExecutiveDashboardPayload } from "@/lib/analytics/analytics-types";

function heatColor(rate: number): string {
  if (rate >= 20) return "bg-red-500/80";
  if (rate >= 10) return "bg-amber-500/70";
  if (rate >= 5) return "bg-yellow-400/60";
  return "bg-emerald-500/50";
}

export function WorkforceHeatmap({
  data,
}: {
  data: ExecutiveDashboardPayload["heatmap"];
}) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No heatmap data available.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[320px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th className="py-2 pr-4">Department</th>
            <th className="py-2 pr-4">Week</th>
            <th className="py-2">Absent rate</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={`${row.department}-${i}`} className="border-b border-border/60">
              <td className="py-2 pr-4 font-medium">{row.department}</td>
              <td className="py-2 pr-4 text-muted-foreground">{row.week}</td>
              <td className="py-2">
                <span
                  className={`inline-flex min-w-[4rem] items-center justify-center rounded px-2 py-1 text-xs font-medium text-foreground ${heatColor(row.absentRate)}`}
                >
                  {row.absentRate}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
