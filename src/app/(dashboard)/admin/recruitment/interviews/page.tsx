import React from "react";
import Link from "next/link";
import { getSessionOrThrow } from "@/lib/auth-guards";
import { canAccessHRAdministration } from "@/lib/permissions";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { Button } from "@/components/ui/button";
import { InterviewTable } from "@/components/recruitment/interviews/interview-table";
import { listInterviewsCached } from "@/lib/recruitment/interview/queries";
import { InterviewStatus } from "@/generated/prisma/enums";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type InterviewView = "upcoming" | "completed" | "cancelled";

function resolveView(raw: string | string[] | undefined): InterviewView {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === "completed" || value === "cancelled") return value;
  return "upcoming";
}

function statusForView(view: InterviewView): InterviewStatus {
  switch (view) {
    case "completed":
      return InterviewStatus.completed;
    case "cancelled":
      return InterviewStatus.cancelled;
    default:
      return InterviewStatus.scheduled;
  }
}

export default async function RecruitmentInterviewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSessionOrThrow();
  const params = await searchParams;
  const view = resolveView(params.view);
  const canManage = canAccessHRAdministration(session.role);

  const result = await listInterviewsCached(
    session,
    { status: statusForView(view) },
    { page: 1, pageSize: 50 },
    { field: "scheduledStart", direction: view === "upcoming" ? "asc" : "desc" }
  );

  const tabs: { id: InterviewView; label: string }[] = [
    { id: "upcoming", label: "Upcoming" },
    { id: "completed", label: "Completed" },
    { id: "cancelled", label: "Cancelled" },
  ];

  return (
    <div className="space-y-6 lg:space-y-8">
      <WorkspacePageHeader
        title="Interviews"
        description="Upcoming and recent interview rounds across active hiring."
        action={
          canManage ? (
            <Link href="/admin/recruitment/interviews/new">
              <Button size="sm" className="font-semibold text-xs rounded-lg gap-1.5 shadow-subtle">
                <Plus className="h-4 w-4" /> Schedule Interview
              </Button>
            </Link>
          ) : null
        }
      />

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={`/admin/recruitment/interviews?view=${tab.id}`}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
              view === tab.id
                ? "border-primary bg-primary/5 text-primary"
                : "border-border bg-card text-muted-foreground hover:bg-muted/20"
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <InterviewTable interviews={result.items as any[]} />
    </div>
  );
}
