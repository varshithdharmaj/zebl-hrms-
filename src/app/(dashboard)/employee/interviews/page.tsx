import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionOrThrow } from "@/lib/auth-guards";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { InterviewTable } from "@/components/recruitment/interviews/interview-table";
import {
  hasPanelistInterviewAssignment,
  listInterviewsCached,
} from "@/lib/recruitment/interview/queries";
import { InterviewStatus } from "@/generated/prisma/enums";
import { isRecruitmentModuleEnabled } from "@/lib/recruitment/config/feature-flags";
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

export default async function EmployeeInterviewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!isRecruitmentModuleEnabled()) {
    notFound();
  }

  const session = await getSessionOrThrow();
  if (!(await hasPanelistInterviewAssignment(session.employeeId))) {
    notFound();
  }
  const params = await searchParams;
  const view = resolveView(params.view);

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
        title="My Interviews"
        description="Interviews where you are on the panel. Submit scorecards after each round."
      />

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={`/employee/interviews?view=${tab.id}`}
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

      <InterviewTable
        interviews={result.items}
        detailHrefPrefix="/employee/interviews"
      />
    </div>
  );
}
