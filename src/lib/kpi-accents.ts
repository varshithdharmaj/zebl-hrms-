import type { LucideIcon } from "lucide-react";

export type KpiAccent = "blue" | "green" | "violet" | "amber" | "teal";

export const kpiAccentStyles: Record<
  KpiAccent,
  { icon: string; ring: string }
> = {
  blue: {
    icon: "bg-blue-50/80 text-blue-700 border border-blue-200/60 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-400/20",
    ring: "ring-0",
  },
  green: {
    icon: "bg-emerald-50/80 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-400/20",
    ring: "ring-0",
  },
  violet: {
    icon: "bg-purple-50/80 text-purple-700 border border-purple-200/60 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-400/20",
    ring: "ring-0",
  },
  amber: {
    icon: "bg-amber-50/80 text-amber-700 border border-amber-200/60 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-400/20",
    ring: "ring-0",
  },
  teal: {
    icon: "bg-teal-50/80 text-teal-700 border border-teal-200/60 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-400/20",
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
