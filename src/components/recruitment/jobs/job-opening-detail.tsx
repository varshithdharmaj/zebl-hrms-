import Link from "next/link";
import type { JobOpeningDetail } from "@/lib/recruitment/job/types";
import type { TimelineItem } from "@/lib/recruitment/types/timeline";
import {
  JOB_EMPLOYMENT_TYPE_LABELS,
  JOB_STATUS_LABELS,
  WORK_MODE_OPTIONS,
} from "@/lib/recruitment/job/labels";
import { JobStatusBadge } from "@/components/recruitment/jobs/job-status-badge";
import { JobOpeningActions } from "@/components/recruitment/jobs/job-opening-actions";
import { JobPublicApplicationSection } from "@/components/recruitment/jobs/job-public-application-section";
import { SectionCard } from "@/components/ui/section-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { HiringTeamRole } from "@/generated/prisma/enums";

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function workModeLabel(value: string | null): string {
  if (!value) return "—";
  return WORK_MODE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

const ROLE_LABELS: Record<HiringTeamRole, string> = {
  recruiter: "Recruiter",
  hiring_manager: "Hiring manager",
  team_lead: "Team lead",
  interviewer: "Interviewer",
};

export function JobOpeningDetailView({
  job,
  timeline,
  showCompensation,
  appBaseUrl,
}: {
  job: JobOpeningDetail;
  timeline: readonly TimelineItem[];
  showCompensation: boolean;
  appBaseUrl: string;
}) {
  return (
    <div className="space-y-6">
      <SectionCard
        title="Overview"
        description={job.code ? `Code ${job.code}` : undefined}
        action={<JobStatusBadge status={job.status} />}
      >
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Department
            </dt>
            <dd className="mt-1 text-sm">{job.department ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Location
            </dt>
            <dd className="mt-1 text-sm">{job.location ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Work mode
            </dt>
            <dd className="mt-1 text-sm">{workModeLabel(job.workMode)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Employment
            </dt>
            <dd className="mt-1 text-sm">{JOB_EMPLOYMENT_TYPE_LABELS[job.employmentType]}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Owner recruiter
            </dt>
            <dd className="mt-1 text-sm">{job.ownerRecruiterEmail ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Pipeline template
            </dt>
            <dd className="mt-1 text-sm">{job.pipelineTemplateName ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Created
            </dt>
            <dd className="mt-1 text-sm">{formatDate(job.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Published
            </dt>
            <dd className="mt-1 text-sm">{formatDate(job.publishedAt)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Closed
            </dt>
            <dd className="mt-1 text-sm">{formatDate(job.closedAt)}</dd>
          </div>
        </dl>
        <div className="mt-6 flex flex-wrap gap-2">
          <JobOpeningActions jobId={job.id} status={job.status} deletedAt={job.deletedAt} />
          <Button variant="outline" size="sm" asChild>
            <Link href={`/admin/recruitment/pipeline?jobOpeningId=${encodeURIComponent(job.id)}`}>
              Open Pipeline
            </Link>
          </Button>
        </div>
      </SectionCard>

      <SectionCard
        title="Public Application"
        description="Let candidates apply directly from a shareable link — no HRMS account needed."
      >
        <JobPublicApplicationSection
          jobId={job.id}
          jobStatus={job.status}
          appBaseUrl={appBaseUrl}
          isPubliclyListed={job.isPubliclyListed}
          publicSlug={job.publicSlug}
        />
      </SectionCard>

      <SectionCard title="Hiring Team">
        {job.hiringTeam.length === 0 ? (
          <EmptyState title="No hiring team yet" description="Assign members when editing this job." />
        ) : (
          <ul className="divide-y divide-border">
            {job.hiringTeam.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-medium">{m.employeeName}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.employeeCode}
                    {m.department ? ` · ${m.department}` : ""}
                  </p>
                </div>
                <span className="text-xs font-medium text-muted-foreground">
                  {ROLE_LABELS[m.role]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Headcount">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Openings
            </dt>
            <dd className="mt-1 text-sm tabular-nums">{job.openingsCount}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Approved
            </dt>
            <dd className="mt-1 text-sm">{job.headcountApproved ? "Yes" : "No"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Urgency
            </dt>
            <dd className="mt-1 text-sm capitalize">{job.headcountUrgency ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Target start
            </dt>
            <dd className="mt-1 text-sm">{formatDate(job.targetStartDate)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Requested by
            </dt>
            <dd className="mt-1 text-sm">{job.headcountRequestedByName ?? "—"}</dd>
          </div>
        </dl>
      </SectionCard>

      {showCompensation && (
        <SectionCard title="Compensation">
          <p className="text-sm">
            {job.compensationCurrency ?? "—"}{" "}
            {job.compensationMin ?? "—"} – {job.compensationMax ?? "—"}
          </p>
        </SectionCard>
      )}

      <SectionCard title="Description">
        {job.description ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{job.description}</p>
        ) : (
          <EmptyState title="No description" />
        )}
      </SectionCard>

      <SectionCard title="Requirements">
        {job.requirements ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{job.requirements}</p>
        ) : (
          <EmptyState title="No requirements listed" />
        )}
      </SectionCard>

      <SectionCard title="Skills">
        {job.skillsText ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{job.skillsText}</p>
        ) : (
          <EmptyState title="No skills listed" />
        )}
      </SectionCard>

      <SectionCard title="At a glance">
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Status
            </dt>
            <dd className="mt-1 text-sm">{JOB_STATUS_LABELS[job.status]}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Applications
            </dt>
            <dd className="mt-1 text-sm tabular-nums">{job.applicationCount}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Pipeline stages
            </dt>
            <dd className="mt-1 text-sm tabular-nums">{job.stages.length}</dd>
          </div>
        </dl>
      </SectionCard>

      <SectionCard title="Timeline">
        {timeline.length === 0 ? (
          <EmptyState title="No timeline events yet" />
        ) : (
          <ul className="space-y-3">
            {timeline.map((item) => (
              <li key={item.id} className="border-l-2 border-border pl-3">
                <p className="text-sm font-medium">{item.summary}</p>
                <p className="text-xs text-muted-foreground">{formatDate(item.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Notes">
        {job.notes.length === 0 ? (
          <EmptyState title="No notes" />
        ) : (
          <ul className="space-y-3">
            {job.notes.map((n) => (
              <li key={n.id} className="rounded-lg border border-border p-3 text-sm">
                <p className="whitespace-pre-wrap">{n.body}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {n.visibility} · {formatDate(n.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
