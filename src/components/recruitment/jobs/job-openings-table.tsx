import Link from "next/link";
import type { JobOpeningListItem } from "@/lib/recruitment/job/types";
import { JOB_EMPLOYMENT_TYPE_LABELS } from "@/lib/recruitment/job/labels";
import { JobStatusBadge } from "@/components/recruitment/jobs/job-status-badge";
import { DataTable, DataTableCell, DataTableRow } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Briefcase } from "lucide-react";

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
        "Title",
        "Status",
        "Department",
        "Hiring manager",
        "Openings",
        "Created",
        "Closed",
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
          <DataTableCell>{formatDate(job.createdAt)}</DataTableCell>
          <DataTableCell>{formatDate(job.closedAt)}</DataTableCell>
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
