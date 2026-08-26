"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
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
import type { ApplicationDetail } from "@/lib/recruitment/repositories/application-repository";
import {
  User,
  Briefcase,
  Eye,
  Edit,
  Archive,
  RotateCcw,
  Star,
  Clock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  buildRecruitmentEntityHref,
  currentPathWithSearch,
  isSafeRecruitmentReturnTo,
} from "@/lib/recruitment/navigation/return-to";
import {
  applicationListHref,
  type ApplicationListFilterState,
} from "@/components/recruitment/applications/application-filters";
import { LIST_PAGE_SIZE_OPTIONS } from "@/lib/recruitment/shared/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { BulkActionBar, type BulkActionBarEmployeeOption } from "./bulk-action-bar";
import {
  ColumnVisibilityMenu,
  useVisibleListColumns,
  OPTIONAL_LIST_COLUMNS,
  type OptionalListColumnKey,
} from "./column-visibility-menu";

function formatOptionalColumn(key: OptionalListColumnKey, app: ApplicationTableItem): string {
  const candidate = app.candidate as
    | (ApplicationTableItem["candidate"] & {
        totalExperienceYears?: number | string | null;
        currentCompany?: string | null;
        location?: string | null;
        noticePeriodDays?: number | null;
        skills?: Array<{ id: string; name: string }>;
      })
    | null;
  if (!candidate) return "—";

  switch (key) {
    case "experience":
      return candidate.totalExperienceYears != null ? `${candidate.totalExperienceYears}y` : "—";
    case "currentCompany":
      return candidate.currentCompany || "—";
    case "noticePeriod":
      return candidate.noticePeriodDays != null ? `${candidate.noticePeriodDays}d` : "—";
    case "location":
      return candidate.location || "—";
    case "skills":
      return candidate.skills && candidate.skills.length > 0
        ? candidate.skills.map((s) => s.name).join(", ")
        : "—";
    default:
      return "—";
  }
}

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

/** List-row fields this table reads from `ApplicationDetail` / listApplications. */
export type ApplicationTableItem = Pick<
  ApplicationDetail,
  | "id"
  | "candidateId"
  | "assignedRecruiterUserId"
  | "deletedAt"
  | "status"
  | "currentStage"
  | "createdAt"
  | "candidate"
  | "jobOpening"
>;

export type ApplicationTablePagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export function ApplicationTable({
  applications,
  employeeOptions,
  pagination,
  filters,
  basePath = "/admin/recruitment/pipeline",
}: {
  applications: readonly ApplicationTableItem[];
  employeeOptions: { id: number; name: string; user: { id: string; email: string } | null }[];
  pagination?: ApplicationTablePagination;
  filters?: ApplicationListFilterState;
  basePath?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const listReturnTo = (() => {
    const path = currentPathWithSearch(pathname, searchParams.toString());
    return isSafeRecruitmentReturnTo(path) ? path : "/admin/recruitment/pipeline";
  })();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [visibleColumns, setVisibleColumns] = useVisibleListColumns();

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

  const selectableIds = applications.filter((a) => !a.deletedAt).map((a) => a.id);
  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(selectableIds));
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
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

      <div className="flex justify-end">
        <ColumnVisibilityMenu visible={visibleColumns} onChange={setVisibleColumns} />
      </div>

      <div className="border border-border rounded-xl overflow-hidden shadow-subtle bg-card">
        <DataTable
          columns={[
            <Checkbox
              key="select-all"
              checked={allSelected}
              onCheckedChange={toggleSelectAll}
              aria-label="Select all rows on this page"
            />,
            "Candidate",
            "Job Opening",
            "Stage",
            "Recruiter",
            ...OPTIONAL_LIST_COLUMNS.filter((c) => visibleColumns.includes(c.key)).map((c) => c.label),
            "Status",
            "Applied Date",
            "Actions",
          ]}
        >
          {applications.map((app) => {
            const recruiterName = app.assignedRecruiterUserId
              ? employeeMap.get(app.assignedRecruiterUserId) ?? "—"
              : "—";

            const isDeleted = !!app.deletedAt;
            const candidateName = app.candidate?.fullName ?? "Unknown";
            const candidateEmail = app.candidate?.email ?? "—";
            const jobTitle = app.jobOpening?.title ?? "—";
            const jobDepartment = app.jobOpening?.department ?? "—";

            return (
              <DataTableRow key={app.id} className={isDeleted ? "opacity-60 bg-muted/10" : ""}>
                <DataTableCell>
                  <Checkbox
                    checked={selectedIds.has(app.id)}
                    onCheckedChange={() => toggleSelectRow(app.id)}
                    disabled={isDeleted}
                    aria-label={`Select ${candidateName}`}
                  />
                </DataTableCell>
                <DataTableCell>
                  <div className="flex items-center gap-3">
                    <CandidateAvatar fullName={candidateName} className="h-9 w-9" />
                    <div>
                      <Link
                        href={buildRecruitmentEntityHref(
                          `/admin/recruitment/candidates/${app.candidateId}`,
                          {
                            returnTo: listReturnTo,
                            applicationId: app.id,
                            jobOpeningId: app.jobOpening?.id,
                            currentStage: app.currentStage,
                          }
                        )}
                        className="font-semibold text-foreground hover:underline hover:text-primary block text-sm"
                      >
                        {candidateName}
                      </Link>
                      <span className="text-xs text-muted-foreground block">{candidateEmail}</span>
                    </div>
                  </div>
                </DataTableCell>
                <DataTableCell>
                  <div>
                    {app.jobOpening?.id ? (
                      <Link
                        href={`/admin/recruitment/jobs/${app.jobOpening.id}`}
                        className="font-semibold text-foreground hover:underline hover:text-primary block text-sm"
                      >
                        {jobTitle}
                      </Link>
                    ) : (
                      <span className="font-semibold text-foreground text-sm block">{jobTitle}</span>
                    )}
                    <span className="text-xs text-muted-foreground block">{jobDepartment}</span>
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
                {OPTIONAL_LIST_COLUMNS.filter((c) => visibleColumns.includes(c.key)).map((c) => (
                  <DataTableCell key={c.key} className="text-sm text-muted-foreground">
                    {formatOptionalColumn(c.key, app)}
                  </DataTableCell>
                ))}
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
                      <Link
                        href={buildRecruitmentEntityHref(
                          `/admin/recruitment/applications/${app.id}`,
                          {
                            returnTo: listReturnTo,
                            jobOpeningId: app.jobOpening?.id,
                            currentStage: app.currentStage,
                          }
                        )}
                      >
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
                          onClick={() => handleArchive(app.id, candidateName)}
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

      {pagination ? (
        <ApplicationTablePaginationBar
          pagination={pagination}
          filters={filters ?? {}}
          basePath={basePath}
        />
      ) : null}

      <BulkActionBar
        selectedIds={[...selectedIds]}
        employeeOptions={employeeOptions as BulkActionBarEmployeeOption[]}
        onDone={() => setSelectedIds(new Set())}
        onClearSelection={() => setSelectedIds(new Set())}
      />

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

function ApplicationTablePaginationBar({
  pagination,
  filters,
  basePath,
}: {
  pagination: ApplicationTablePagination;
  filters: ApplicationListFilterState;
  basePath: string;
}) {
  const router = useRouter();
  const { page, pageSize, total, totalPages } = pagination;
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(total, page * pageSize);

  const handlePageSizeChange = (value: string) => {
    router.push(
      applicationListHref({ ...filters, pageSize: Number(value) }, undefined, basePath)
    );
  };

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-border/60 pt-3 sm:flex-row">
      <p className="text-xs font-medium text-muted-foreground">
        {total === 0
          ? "No applications"
          : `Showing ${rangeStart}–${rangeEnd} of ${total} applications`}
      </p>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground">Per page</span>
          <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
            <SelectTrigger className="h-8 w-[72px] bg-background text-xs" aria-label="Rows per page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LIST_PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            asChild={page > 1}
            variant="outline"
            size="icon"
            disabled={page <= 1}
            className="h-8 w-8 rounded-lg"
            title="Previous page"
          >
            {page > 1 ? (
              <Link href={applicationListHref(filters, page - 1, basePath)}>
                <ChevronLeft className="h-4 w-4" />
              </Link>
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
          <span className="min-w-[64px] text-center text-xs font-semibold tabular-nums text-muted-foreground">
            Page {totalPages === 0 ? 0 : page} of {totalPages}
          </span>
          <Button
            asChild={page < totalPages}
            variant="outline"
            size="icon"
            disabled={page >= totalPages}
            className="h-8 w-8 rounded-lg"
            title="Next page"
          >
            {page < totalPages ? (
              <Link href={applicationListHref(filters, page + 1, basePath)}>
                <ChevronRight className="h-4 w-4" />
              </Link>
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
