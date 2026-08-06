import Link from "next/link";
import {
  BarChart3,
  Briefcase,
  CalendarDays,
  FileCheck,
  UserCheck,
} from "lucide-react";

const SECTIONS = [
  {
    href: "/admin/recruitment/reports/hiring",
    title: "Hiring Reports",
    description: "Funnel, recruiter performance, departments, sources, time-to-hire.",
    icon: Briefcase,
  },
  {
    href: "/admin/recruitment/reports/interviews",
    title: "Interview Reports",
    description: "Interview volume, outcomes, and feedback quality.",
    icon: CalendarDays,
  },
  {
    href: "/admin/recruitment/reports/offers",
    title: "Offer Reports",
    description: "Offer outcomes, declines, expirations, and revisions.",
    icon: FileCheck,
  },
  {
    href: "/admin/recruitment/reports/conversions",
    title: "Conversion Reports",
    description: "Offer-to-employee conversion and pending joins.",
    icon: UserCheck,
  },
] as const;

export function ReportHub() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5 shadow-subtle">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-teal-700" aria-hidden />
          <h2 className="text-base font-semibold">Recruitment reporting hub</h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Scope-aware exports powered by the same queries as Insights above. Export CSV, Excel, or
          printable PDF HTML.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <Link
              key={section.href}
              href={section.href}
              className="rounded-xl border border-border bg-card p-5 shadow-subtle transition hover:border-teal-600/40 hover:shadow-md"
            >
              <Icon className="mb-3 h-5 w-5 text-teal-700" aria-hidden />
              <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{section.description}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
