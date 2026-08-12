"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  createJobOpeningAction,
  updateJobOpeningAction,
  type RecruitmentJobActionState,
} from "@/actions/recruitment-jobs";
import type { JobOpeningDetail } from "@/lib/recruitment/job/types";
import {
  JOB_EMPLOYMENT_TYPE_LABELS,
  HEADCOUNT_URGENCY_OPTIONS,
  WORK_MODE_OPTIONS,
} from "@/lib/recruitment/job/labels";
import { JobEmploymentType } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionCard } from "@/components/ui/section-card";
import { ErrorAlert } from "@/components/ui/error-alert";

export type EmployeeOption = {
  id: number;
  name: string;
  employeeCode: string;
  department: string | null;
  user: { id: string; email: string } | null;
};

export type TemplateOption = {
  id: string;
  name: string;
  isSystem: boolean;
};

const initial: RecruitmentJobActionState = {};

function toDateInput(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function JobOpeningForm({
  mode,
  job,
  employees,
  templates,
  showCompensation,
  currentUserId,
}: {
  mode: "create" | "edit";
  job?: JobOpeningDetail;
  employees: EmployeeOption[];
  templates: TemplateOption[];
  showCompensation: boolean;
  currentUserId: string;
}) {
  const action = mode === "create" ? createJobOpeningAction : updateJobOpeningAction;
  const [state, formAction, pending] = useActionState(action, initial);

  const [employmentType, setEmploymentType] = useState(
    job?.employmentType ?? JobEmploymentType.full_time
  );
  const [workMode, setWorkMode] = useState(job?.workMode ?? "");
  const [urgency, setUrgency] = useState(job?.headcountUrgency ?? "");
  const [templateId, setTemplateId] = useState(job?.pipelineTemplateId ?? templates[0]?.id ?? "");
  const [hmId, setHmId] = useState(
    job?.hiringManagerEmployeeId != null ? String(job.hiringManagerEmployeeId) : ""
  );
  const [ownerUserId, setOwnerUserId] = useState(
    job?.ownerRecruiterUserId ?? currentUserId
  );
  const [recruiterEmployeeId, setRecruiterEmployeeId] = useState("");
  const [teamLeadId, setTeamLeadId] = useState("");

  const ownerOptions = employees
    .filter((e) => e.user)
    .map((e) => ({ userId: e.user!.id, label: `${e.name} (${e.user!.email})` }));

  return (
    <form action={formAction} className="space-y-6">
      {mode === "edit" && job ? <input type="hidden" name="id" value={job.id} /> : null}
      <input type="hidden" name="employmentType" value={employmentType} />
      <input type="hidden" name="workMode" value={workMode} />
      <input type="hidden" name="headcountUrgency" value={urgency} />
      <input type="hidden" name="pipelineTemplateId" value={templateId} />
      <input type="hidden" name="hiringManagerEmployeeId" value={hmId} />
      <input type="hidden" name="ownerRecruiterUserId" value={ownerUserId} />
      <input type="hidden" name="recruiterEmployeeId" value={recruiterEmployeeId} />
      {teamLeadId ? <input type="hidden" name="teamLeadEmployeeIds" value={teamLeadId} /> : null}

      {state.error && <ErrorAlert message={state.error} />}
      {state.success && mode === "edit" && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {state.success}
        </p>
      )}

      <SectionCard title="Basic Information" description="Role identity and placement.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required defaultValue={job?.title ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="code">Code</Label>
            <Input id="code" name="code" defaultValue={job?.code ?? ""} placeholder="Optional unique code" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="department">Department</Label>
            <Input id="department" name="department" defaultValue={job?.department ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="location">Location</Label>
            <Input id="location" name="location" defaultValue={job?.location ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label>Work mode</Label>
            <Select value={workMode || "none"} onValueChange={(v) => setWorkMode(v === "none" ? "" : v)}>
              <SelectTrigger aria-label="Work mode">
                <SelectValue placeholder="Select work mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not specified</SelectItem>
                {WORK_MODE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Hiring Team" description="Assign hiring manager, recruiter, and team lead.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Hiring manager</Label>
            <Select value={hmId || "none"} onValueChange={(v) => setHmId(v === "none" ? "" : v)}>
              <SelectTrigger aria-label="Hiring manager">
                <SelectValue placeholder="Select hiring manager" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={String(e.id)}>
                    {e.name} ({e.employeeCode})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Owner recruiter (user)</Label>
            <Select value={ownerUserId} onValueChange={setOwnerUserId}>
              <SelectTrigger aria-label="Owner recruiter">
                <SelectValue placeholder="Select owner" />
              </SelectTrigger>
              <SelectContent>
                {ownerOptions.map((o) => (
                  <SelectItem key={o.userId} value={o.userId}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {mode === "create" && (
            <>
              <div className="space-y-1.5">
                <Label>Recruiter (team)</Label>
                <Select
                  value={recruiterEmployeeId || "none"}
                  onValueChange={(v) => setRecruiterEmployeeId(v === "none" ? "" : v)}
                >
                  <SelectTrigger aria-label="Recruiter">
                    <SelectValue placeholder="Optional recruiter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={String(e.id)}>
                        {e.name} ({e.employeeCode})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Team lead</Label>
                <Select
                  value={teamLeadId || "none"}
                  onValueChange={(v) => setTeamLeadId(v === "none" ? "" : v)}
                >
                  <SelectTrigger aria-label="Team lead">
                    <SelectValue placeholder="Optional team lead" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={String(e.id)}>
                        {e.name} ({e.employeeCode})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Headcount" description="Approved openings and urgency.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="openingsCount">Openings</Label>
            <Input
              id="openingsCount"
              name="openingsCount"
              type="number"
              min={1}
              required
              defaultValue={job?.openingsCount ?? 1}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Urgency</Label>
            <Select value={urgency || "none"} onValueChange={(v) => setUrgency(v === "none" ? "" : v)}>
              <SelectTrigger aria-label="Headcount urgency">
                <SelectValue placeholder="Select urgency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not specified</SelectItem>
                {HEADCOUNT_URGENCY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 sm:col-span-2">
            <input
              id="headcountApproved"
              name="headcountApproved"
              type="checkbox"
              value="true"
              defaultChecked={job?.headcountApproved ?? false}
              className="h-4 w-4 rounded border-border"
            />
            <Label htmlFor="headcountApproved">Headcount approved</Label>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="headcountRequestedByEmployeeId">Requested by (employee id)</Label>
            <Input
              id="headcountRequestedByEmployeeId"
              name="headcountRequestedByEmployeeId"
              type="number"
              defaultValue={job?.headcountRequestedByEmployeeId ?? ""}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Employment Details">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Employment type</Label>
            <Select
              value={employmentType}
              onValueChange={(v) => setEmploymentType(v as JobEmploymentType)}
            >
              <SelectTrigger aria-label="Employment type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(JOB_EMPLOYMENT_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {mode === "create" && (
            <div className="space-y-1.5">
              <Label>Pipeline template</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger aria-label="Pipeline template">
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                      {t.isSystem ? " (system)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </SectionCard>

      {showCompensation && (
        <SectionCard title="Compensation" description="Visible to Super Admin and HR only.">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="compensationCurrency">Currency</Label>
              <Input
                id="compensationCurrency"
                name="compensationCurrency"
                defaultValue={job?.compensationCurrency ?? "INR"}
                maxLength={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="compensationMin">Minimum</Label>
              <Input
                id="compensationMin"
                name="compensationMin"
                defaultValue={job?.compensationMin ?? ""}
                inputMode="decimal"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="compensationMax">Maximum</Label>
              <Input
                id="compensationMax"
                name="compensationMax"
                defaultValue={job?.compensationMax ?? ""}
                inputMode="decimal"
              />
            </div>
          </div>
        </SectionCard>
      )}

      <SectionCard title="Hiring Timeline">
        <div className="space-y-1.5 max-w-xs">
          <Label htmlFor="targetStartDate">Target start date</Label>
          <Input
            id="targetStartDate"
            name="targetStartDate"
            type="date"
            defaultValue={toDateInput(job?.targetStartDate)}
          />
        </div>
      </SectionCard>

      <SectionCard title="Description">
        <Textarea
          name="description"
          rows={5}
          defaultValue={job?.description ?? ""}
          placeholder="Role summary and responsibilities"
        />
      </SectionCard>

      <SectionCard title="Requirements">
        <Textarea
          name="requirements"
          rows={5}
          defaultValue={job?.requirements ?? ""}
          placeholder="Must-have experience, education, certifications"
        />
      </SectionCard>

      <SectionCard title="Skills">
        <Textarea
          name="skills"
          rows={3}
          defaultValue={job?.skillsText ?? ""}
          placeholder="Comma or line-separated skills"
        />
      </SectionCard>

      {mode === "create" && (
        <SectionCard title="Notes">
          <Textarea name="notes" rows={3} placeholder="Internal HR note (optional)" />
          <div className="mt-4 flex items-center gap-2">
            <input
              id="publish"
              name="publish"
              type="checkbox"
              value="true"
              className="h-4 w-4 rounded border-border"
            />
            <Label htmlFor="publish">Publish as open immediately</Label>
          </div>
        </SectionCard>
      )}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={pending}>
          {pending ? "Saving…" : mode === "create" ? "Create job opening" : "Save changes"}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href={job ? `/admin/recruitment/jobs/${job.id}` : "/admin/recruitment/jobs"}>
            Cancel
          </Link>
        </Button>
      </div>
    </form>
  );
}
