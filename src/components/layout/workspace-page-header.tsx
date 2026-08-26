import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function WorkspacePageHeader({
  title,
  description,
  backHref,
  backLabel = "Back",
  action,
  badge,
}: {
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  action?: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <section className="rounded-[var(--radius-card)] border border-border bg-card p-6 shadow-card lg:p-8">
      {backHref && (
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-5 w-fit">
          <Link href={backHref}>
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Link>
        </Button>
      )}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 space-y-3">
          {badge}
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {title}
            </h1>
            {description && (
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-[0.9375rem]">
                {description}
              </p>
            )}
          </div>
        </div>
        {action && <div className="w-full shrink-0 lg:w-auto">{action}</div>}
      </div>
    </section>
  );
}
