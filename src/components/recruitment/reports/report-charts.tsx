"use client";

import type { ReportChart } from "@/lib/recruitment/reports/types";

const COLORS = ["#0f766e", "#2563eb", "#d97706", "#16a34a", "#7c3aed", "#dc2626"];

function BarChart({ chart }: { chart: ReportChart }) {
  const primary = chart.series[0];
  if (!primary) return null;
  const max = Math.max(...primary.values, 1);
  return (
    <div className="space-y-2" role="img" aria-label={chart.title}>
      {chart.labels.map((label, index) => {
        const value = primary.values[index] ?? 0;
        const width = Math.max((value / max) * 100, value > 0 ? 4 : 0);
        return (
          <div key={`${label}-${index}`} className="flex items-center gap-2">
            <span className="w-28 shrink-0 truncate text-xs text-slate-500">{label}</span>
            <div className="relative h-6 flex-1 overflow-hidden rounded bg-slate-100">
              <div
                className="absolute inset-y-0 left-0 flex items-center px-2 text-[10px] font-semibold text-white"
                style={{
                  width: `${width}%`,
                  background: primary.color ?? COLORS[0],
                }}
              >
                {width > 18 ? value : ""}
              </div>
            </div>
            <span className="w-10 text-right text-xs font-medium tabular-nums">{value}</span>
          </div>
        );
      })}
    </div>
  );
}

function LineChart({ chart }: { chart: ReportChart }) {
  const width = 640;
  const height = 180;
  const padding = 24;
  const max = Math.max(
    ...chart.series.flatMap((series) => series.values),
    1
  );
  const pointsFor = (values: number[]) =>
    values
      .map((value, index) => {
        const x =
          padding +
          (index / Math.max(values.length - 1, 1)) * (width - padding * 2);
        const y = height - padding - (value / max) * (height - padding * 2);
        return `${x},${y}`;
      })
      .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-48 w-full" role="img" aria-label={chart.title}>
      {chart.series.map((series, seriesIndex) => (
        <polyline
          key={series.label}
          fill="none"
          stroke={series.color ?? COLORS[seriesIndex % COLORS.length]}
          strokeWidth="2.5"
          points={pointsFor(series.values)}
        />
      ))}
    </svg>
  );
}

function PieChart({ chart }: { chart: ReportChart }) {
  const values = chart.series[0]?.values ?? [];
  const total = values.reduce((sum, value) => sum + value, 0) || 1;
  let angle = 0;
  const slices = values.map((value, index) => {
    const sweep = (value / total) * 360;
    const start = angle;
    angle += sweep;
    const large = sweep > 180 ? 1 : 0;
    const rad = (deg: number) => (Math.PI / 180) * deg;
    const x1 = 50 + 40 * Math.cos(rad(start - 90));
    const y1 = 50 + 40 * Math.sin(rad(start - 90));
    const x2 = 50 + 40 * Math.cos(rad(start + sweep - 90));
    const y2 = 50 + 40 * Math.sin(rad(start + sweep - 90));
    return {
      label: chart.labels[index] ?? `Slice ${index + 1}`,
      value,
      color: COLORS[index % COLORS.length],
      d: `M50,50 L${x1},${y1} A40,40 0 ${large} 1 ${x2},${y2} Z`,
    };
  });

  return (
    <div className="flex flex-wrap items-center gap-4">
      <svg viewBox="0 0 100 100" className="h-40 w-40" role="img" aria-label={chart.title}>
        {slices.map((slice) => (
          <path key={slice.label} d={slice.d} fill={slice.color} />
        ))}
      </svg>
      <ul className="space-y-1 text-xs">
        {slices.map((slice) => (
          <li key={slice.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: slice.color }} />
            <span className="font-medium">{slice.label}</span>
            <span className="text-muted-foreground tabular-nums">{slice.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StackedChart({ chart }: { chart: ReportChart }) {
  const max = Math.max(
    ...chart.labels.map((_, index) =>
      chart.series.reduce((sum, series) => sum + (series.values[index] ?? 0), 0)
    ),
    1
  );

  return (
    <div className="space-y-2" aria-label={chart.title}>
      {chart.labels.map((label, index) => {
        const total = chart.series.reduce(
          (sum, series) => sum + (series.values[index] ?? 0),
          0
        );
        return (
          <div key={`${label}-${index}`} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-600">{label}</span>
              <span className="tabular-nums text-slate-500">{total}</span>
            </div>
            <div className="flex h-5 overflow-hidden rounded bg-slate-100">
              {chart.series.map((series, seriesIndex) => {
                const value = series.values[index] ?? 0;
                const width = (value / max) * 100;
                if (width <= 0) return null;
                return (
                  <div
                    key={series.label}
                    title={`${series.label}: ${value}`}
                    style={{
                      width: `${width}%`,
                      background: series.color ?? COLORS[seriesIndex % COLORS.length],
                    }}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ReportCharts({ charts }: { charts: ReportChart[] }) {
  if (charts.length === 0) return null;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {charts.map((chart) => (
        <section
          key={chart.id}
          className="rounded-xl border border-border bg-card p-4 shadow-subtle"
        >
          <h3 className="mb-3 text-sm font-semibold text-foreground">{chart.title}</h3>
          {chart.kind === "bar" && <BarChart chart={chart} />}
          {chart.kind === "line" && <LineChart chart={chart} />}
          {chart.kind === "pie" && <PieChart chart={chart} />}
          {chart.kind === "stacked" && <StackedChart chart={chart} />}
        </section>
      ))}
    </div>
  );
}
