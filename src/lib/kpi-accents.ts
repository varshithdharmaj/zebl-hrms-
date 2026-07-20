import type { LucideIcon } from "lucide-react";

export type KpiAccent = "blue" | "green" | "violet" | "amber" | "teal";

export const kpiAccentStyles: Record<
  KpiAccent,
  { icon: string; ring: string }
> = {
  blue: {
    icon: "bg-blue-50/80 text-blue-700 border border-blue-200/60",
    ring: "ring-0",
  },
  green: {
    icon: "bg-emerald-50/80 text-emerald-700 border border-emerald-200/60",
    ring: "ring-0",
  },
  violet: {
    icon: "bg-purple-50/80 text-purple-700 border border-purple-200/60",
    ring: "ring-0",
  },
  amber: {
    icon: "bg-amber-50/80 text-amber-700 border border-amber-200/60",
    ring: "ring-0",
  },
  teal: {
    icon: "bg-teal-50/80 text-teal-700 border border-teal-200/60",
    ring: "ring-0",
  },
};

export type KpiStat = {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  accent: KpiAccent;
};
