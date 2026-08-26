import Link from "next/link";
import type { JobOpeningListItem } from "@/lib/recruitment/job/types";
import { JOB_EMPLOYMENT_TYPE_LABELS } from "@/lib/recruitment/job/labels";
import { formatJobOpeningAge } from "@/lib/recruitment/job/format-age";
import { JobStatusBadge } from "@/components/recruitment/jobs/job-status-badge";
import { DataTable, DataTableCell, DataTableRow } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Briefcase } from "lucide-react";
import { INTERVIEWING_STAGE_FILTER } from "@/lib/recruitment/shared/pipeline-stage-groups";
import { cn } from "@/lib/utils";

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

function pipelineHref(jobId: string, extra?: Record<string, string>): string {
  const params = new URLSearchParams({ jobOpeningId: jobId, view: "list", ...extra });
  return `/admin/recruitment/pipeline?${params.toString()}`;
}

/** Compact, clickable recruiter metric cell. Always shows 0, never "—". */
function MetricLink({ href, value, label }: { href: string; value: number; label: string }) {
  return (
    <Link
      href={href}
      aria-label={`${label}: ${value}`}
      className={cn(
        "inline-flex min-w-[2rem] justify-center rounded-md px-2 py-0.5 text-sm font-semibold tabular-nums",
        "text-foreground hover:bg-muted hover:underline"
      )}
    >
      {value}
    </Link>
  );
}

export function JobOpeningsTable({ jobs }: { jobs: JobOpeningListItem[] }) {
  if (jobs.length === 0) {
    return (
      <EmptyState
        icon={Briefcase}
        title="No job openings"
        description="Create a job opening to start hiring for a role."
        action={
          <Button asChild>
            <Link href="/admin/recruitment/jobs/new">Create job opening</Link>
          </Button>
        }
      />
    );
  }

  return (
    <DataTable
      columns={[
        "Job Opening",
        "Status",
        "Department",
        "Hiring manager",
        "Positions",
        "Applicants",
        "Interviews",
        "Hired",
        "Age",
        "Actions",
      ]}
    >
      {jobs.map((job) => (
        <DataTableRow key={job.id}>
          <DataTableCell>
            <Link
              href={`/admin/recruitment/jobs/${job.id}`}
              className="font-medium text-foreground hover:underline"
            >
              {job.title}
            </Link>
            {job.code ? (
              <p className="text-xs text-muted-foreground">{job.code}</p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              {JOB_EMPLOYMENT_TYPE_LABELS[job.employmentType]}
            </p>
          </DataTableCell>
          <DataTableCell>
            <JobStatusBadge status={job.status} />
            {job.deletedAt ? (
              <p className="mt-1 text-xs text-muted-foreground">Archived</p>
            ) : null}
          </DataTableCell>
          <DataTableCell>{job.department ?? "—"}</DataTableCell>
          <DataTableCell>{job.hiringManagerName ?? "—"}</DataTableCell>
          <DataTableCell className="tabular-nums">{job.openingsCount}</DataTableCell>
          <DataTableCell>
            <MetricLink
              href={pipelineHref(job.id)}
              value={job.applicationCount}
              label="Applicants"
            />
          </DataTableCell>
          <DataTableCell>
            <MetricLink
              href={pipelineHref(job.id, { currentStage: INTERVIEWING_STAGE_FILTER })}
              value={job.interviewedApplicationCount}
              label="Interviews"
            />
          </DataTableCell>
          <DataTableCell>
            <MetricLink
              href={pipelineHref(job.id, { status: "hired" })}
              value={job.hiredApplicationCount}
              label="Hired"
            />
          </DataTableCell>
          <DataTableCell>
            <span title={formatDate(job.createdAt)} className="whitespace-nowrap">
              {formatJobOpeningAge(job)}
            </span>
          </DataTableCell>
          <DataTableCell>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/admin/recruitment/jobs/${job.id}`}>View</Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/admin/recruitment/jobs/${job.id}/edit`}>Edit</Link>
              </Button>
            </div>
          </DataTableCell>
        </DataTableRow>
      ))}
    </DataTable>
  );
}
