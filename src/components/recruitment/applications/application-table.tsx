"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApplicationStatus, RecruitmentPipelineStage } from "@/generated/prisma/enums";
import { CandidateAvatar } from "../candidates/candidate-avatar";
import { CandidateEmptyState } from "../candidates/candidate-empty-state";
import { Button } from "@/components/ui/button";
import { DataTable, DataTableCell, DataTableRow } from "@/components/ui/data-table";
import { ErrorAlert } from "@/components/ui/error-alert";
import { AlertDialog } from "@/components/ui/alert-dialog";
import {
  archiveApplicationAction,
  restoreApplicationAction,
} from "@/actions/recruitment-applications";
import {
  User,
  Briefcase,
  Eye,
  Edit,
  Archive,
  RotateCcw,
  Star,
  Clock,
} from "lucide-react";

function formatDate(value: Date | string | null): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ApplicationTable({
  applications,
  employeeOptions,
}: {
  applications: any[];
  employeeOptions: { id: number; name: string; user: { id: string; email: string } | null }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // AlertDialog configuration state
  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    actionLabel?: string;
    onAction: () => void;
    isDestructive?: boolean;
  } | null>(null);

  const employeeMap = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const emp of employeeOptions) {
      if (emp.user?.id) {
        map.set(emp.user.id, emp.name);
      }
    }
    return map;
  }, [employeeOptions]);

  if (applications.length === 0) {
    return (
      <CandidateEmptyState
        icon={Briefcase}
        title="No applications found"
        description="Add an application or adjust your filters to start tracking candidates in the hiring pipeline."
        actionLabel="New application"
        actionHref="/admin/recruitment/applications/new"
      />
    );
  }

  const handleArchive = (id: string, name: string) => {
    setAlertConfig({
      isOpen: true,
      title: "Archive Application",
      description: `Are you sure you want to archive the application for ${name}? This is a soft delete.`,
      actionLabel: "Archive",
      isDestructive: true,
      onAction: () => {
        setError(null);
        setSuccess(null);
        startTransition(async () => {
          const res = await archiveApplicationAction({}, { id });
          if (res.error) {
            setError(res.error);
          } else {
            setSuccess("Application archived successfully.");
            router.refresh();
          }
        });
      },
    });
  };

  const handleRestore = (id: string) => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await restoreApplicationAction({}, { id });
      if (res.error) {
        setError(res.error);
      } else {
        setSuccess("Application restored successfully.");
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-4">
      {error && <ErrorAlert message={error} />}
      {success && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/30 dark:bg-emerald-500/10 dark:text-emerald-400">
          {success}
        </p>
      )}

      <div className="border border-border rounded-xl overflow-hidden shadow-subtle bg-card">
        <DataTable
          columns={["Candidate", "Job Opening", "Stage", "Recruiter", "Status", "Applied Date", "Actions"]}
        >
          {applications.map((app) => {
            const recruiterName = app.assignedRecruiterUserId
              ? employeeMap.get(app.assignedRecruiterUserId) ?? "—"
              : "—";

            const isDeleted = !!app.deletedAt;

            return (
              <DataTableRow key={app.id} className={isDeleted ? "opacity-60 bg-muted/10" : ""}>
                <DataTableCell>
                  <div className="flex items-center gap-3">
                    <CandidateAvatar fullName={app.candidate.fullName} className="h-9 w-9" />
                    <div>
                      <Link
                        href={`/admin/recruitment/candidates/${app.candidateId}`}
                        className="font-semibold text-foreground hover:underline hover:text-primary block text-sm"
                      >
                        {app.candidate.fullName}
                      </Link>
                      <span className="text-xs text-muted-foreground block">{app.candidate.email}</span>
                    </div>
                  </div>
                </DataTableCell>
                <DataTableCell>
                  <div>
                    <span className="font-semibold text-foreground text-sm block">{app.jobOpening.title}</span>
                    <span className="text-xs text-muted-foreground block">{app.jobOpening.department}</span>
                  </div>
                </DataTableCell>
                <DataTableCell>
                  <span className="inline-flex items-center rounded-full bg-primary/5 border border-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                    {app.currentStage.replace(/_/g, " ").toUpperCase()}
                  </span>
                </DataTableCell>
                <DataTableCell className="text-sm font-medium text-foreground">
                  {recruiterName}
                </DataTableCell>
                <DataTableCell>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold border ${
                      app.status === ApplicationStatus.active
                        ? "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-500/10 dark:border-blue-500/20 dark:text-blue-400"
                        : app.status === ApplicationStatus.hired
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400"
                        : app.status === ApplicationStatus.rejected
                        ? "bg-red-50 border-red-200 text-red-700 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400"
                        : "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-400"
                    }`}
                  >
                    {app.status.replace(/_/g, " ").toUpperCase()}
                  </span>
                </DataTableCell>
                <DataTableCell className="text-sm text-muted-foreground tabular-nums">
                  {formatDate(app.createdAt)}
                </DataTableCell>
                <DataTableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      asChild
                      className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                      title="View Application"
                    >
                      <Link href={`/admin/recruitment/applications/${app.id}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                    {!isDeleted ? (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                          className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                          title="Edit Application"
                        >
                          <Link href={`/admin/recruitment/applications/${app.id}/edit`}>
                            <Edit className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleArchive(app.id, app.candidate.fullName)}
                          className="h-8 w-8 rounded-lg text-muted-foreground hover:text-danger hover:bg-danger-muted/30"
                          title="Archive Application"
                          disabled={isPending}
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRestore(app.id)}
                        className="h-8 w-8 rounded-lg text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50/50"
                        title="Restore Application"
                        disabled={isPending}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </DataTableCell>
              </DataTableRow>
            );
          })}
        </DataTable>
      </div>

      {alertConfig && (
        <AlertDialog
          isOpen={alertConfig.isOpen}
          onOpenChange={(open) => setAlertConfig(open ? alertConfig : null)}
          title={alertConfig.title}
          description={alertConfig.description}
          actionLabel={alertConfig.actionLabel}
          isActionDestructive={alertConfig.isDestructive}
          isPending={isPending}
          onAction={() => {
            alertConfig.onAction();
            setAlertConfig(null);
          }}
        />
      )}
    </div>
  );
}
