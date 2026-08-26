import type { LucideIcon } from "lucide-react";

export type KpiAccent = "blue" | "green" | "violet" | "amber" | "teal";

export const kpiAccentStyles: Record<
  KpiAccent,
  { icon: string; ring: string }
> = {
  blue: {
    icon: "bg-accent-blue-muted text-accent-blue",
    ring: "ring-accent-blue/10",
  },
  green: {
    icon: "bg-accent-green-muted text-accent-green",
    ring: "ring-accent-green/10",
  },
  violet: {
    icon: "bg-accent-violet-muted text-accent-violet",
    ring: "ring-accent-violet/10",
  },
  amber: {
    icon: "bg-accent-amber-muted text-accent-amber",
    ring: "ring-accent-amber/10",
  },
  teal: {
    icon: "bg-accent-teal-muted text-accent-teal",
    ring: "ring-accent-teal/10",
  },
};

export type KpiStat = {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  accent: KpiAccent;
};
