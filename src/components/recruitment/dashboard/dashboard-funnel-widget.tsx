import {
  buildHiringFunnelCounts,
  FUNNEL_LABELS,
  type HiringFunnelCounts,
} from "@/lib/recruitment/dashboard/build-funnel-counts";

export function DashboardFunnelWidget({ funnel }: { funnel: HiringFunnelCounts }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-subtle">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-foreground">Hiring Funnel</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Live stage counts across the pipeline.</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {FUNNEL_LABELS.map(({ key, label }) => (
          <div
            key={key}
            className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5 text-center"
          >
            <div className="text-xl font-bold tabular-nums text-foreground">{funnel[key]}</div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-1">
              {label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export { buildHiringFunnelCounts };
