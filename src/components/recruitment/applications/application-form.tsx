"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createApplicationAction,
  updateApplicationAction,
  type RecruitmentApplicationActionState,
} from "@/actions/recruitment-applications";
import { ApplicationPriority, CandidateSource } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CandidateSection } from "@/components/recruitment/candidates/candidate-section";
import { ErrorAlert } from "@/components/ui/error-alert";
import type { ApplicationDetail } from "@/lib/recruitment/repositories/application-repository";
import { buildApplicationCreateRedirect } from "@/lib/recruitment/navigation/return-to";

export type EmployeeOption = {
  id: number;
  name: string;
  employeeCode: string;
  department: string | null;
  user: { id: string; email: string } | null;
};

/** Edit/create initial values — only the fields this form reads from `ApplicationDetail`. */
export type ApplicationFormValues = Pick<
  ApplicationDetail,
  | "id"
  | "candidateId"
  | "jobOpeningId"
  | "assignedRecruiterUserId"
  | "assignedManagerEmployeeId"
  | "priority"
  | "source"
>;

const initial: RecruitmentApplicationActionState = {};

export function ApplicationForm({
  mode,
  application,
  candidates,
  jobs,
  employees,
  preselectedCandidateId,
  returnTo,
}: {
  mode: "create" | "edit";
  application?: ApplicationFormValues;
  candidates: { id: string; fullName: string }[];
  jobs: { id: string; title: string }[];
  employees: EmployeeOption[];
  preselectedCandidateId?: string;
  /** Validated Recruitment returnTo — forwarded to Pipeline after create. */
  returnTo?: string | null;
}) {
  const router = useRouter();
  const action = mode === "create" ? createApplicationAction : updateApplicationAction;
  const [state, formAction, pending] = useActionState(action, initial);

  const [candidateId, setCandidateId] = useState(
    application?.candidateId ?? preselectedCandidateId ?? ""
  );
  const [jobOpeningId, setJobOpeningId] = useState(application?.jobOpeningId ?? "");
  const [assignedRecruiterUserId, setAssignedRecruiterUserId] = useState(
    application?.assignedRecruiterUserId ?? ""
  );
  const [assignedManagerEmployeeId, setAssignedManagerEmployeeId] = useState(
    application?.assignedManagerEmployeeId ? String(application.assignedManagerEmployeeId) : ""
  );
  const [priority, setPriority] = useState<ApplicationPriority>(
    application?.priority ?? ApplicationPriority.normal
  );
  const [source, setSource] = useState<CandidateSource>(
    application?.source ?? CandidateSource.manual_upload
  );

  useEffect(() => {
    if (!state.success) return;
    if (mode === "create" && state.applicationId) {
      router.push(
        buildApplicationCreateRedirect({
          applicationId: state.applicationId,
          jobOpeningId: jobOpeningId || undefined,
          returnTo,
        })
      );
      router.refresh();
      return;
    }
    if (mode === "edit" && application?.id) {
      router.push(`/admin/recruitment/applications/${application.id}`);
      router.refresh();
    }
  }, [state.success, state.applicationId, mode, application?.id, jobOpeningId, returnTo, router]);

  return (
    <form action={formAction} className="space-y-6 max-w-3xl">
      {state.error && <ErrorAlert message={state.error} />}

      {mode === "edit" && application ? (
        <input type="hidden" name="id" value={application.id} />
      ) : null}
      <input type="hidden" name="candidateId" value={candidateId} />
      <input type="hidden" name="jobOpeningId" value={jobOpeningId} />
      <input type="hidden" name="assignedRecruiterUserId" value={assignedRecruiterUserId} />
      <input type="hidden" name="assignedManagerEmployeeId" value={assignedManagerEmployeeId} />
      <input type="hidden" name="priority" value={priority} />
      <input type="hidden" name="source" value={source} />

      <CandidateSection title="Application Details" description="Link a candidate to an open job position.">
        <div className="grid gap-5 sm:grid-cols-2">
          {/* Candidate Selection */}
          <div className="space-y-1.5">
            <Label className="font-bold text-xs text-muted-foreground uppercase tracking-wider">Candidate</Label>
            {mode === "edit" || preselectedCandidateId ? (
              <div className="h-10 px-3 border border-border rounded-lg bg-muted flex items-center text-sm font-semibold text-foreground">
                {candidates.find((c) => c.id === candidateId)?.fullName ?? "Selected Candidate"}
              </div>
            ) : (
              <Select value={candidateId} onValueChange={setCandidateId} disabled={pending}>
                <SelectTrigger className="h-10 bg-background">
                  <SelectValue placeholder="Select candidate" />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Job Selection */}
          <div className="space-y-1.5">
            <Label className="font-bold text-xs text-muted-foreground uppercase tracking-wider">Job Opening</Label>
            {mode === "edit" ? (
              <div className="h-10 px-3 border border-border rounded-lg bg-muted flex items-center text-sm font-semibold text-foreground">
                {jobs.find((j) => j.id === jobOpeningId)?.title ?? "Selected Job"}
              </div>
            ) : (
              <Select value={jobOpeningId} onValueChange={setJobOpeningId} disabled={pending}>
                <SelectTrigger className="h-10 bg-background">
                  <SelectValue placeholder="Select job opening" />
                </SelectTrigger>
                <SelectContent>
                  {jobs.map((j) => (
                    <SelectItem key={j.id} value={j.id}>
                      {j.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Recruiter Assignment */}
          <div className="space-y-1.5">
            <Label className="font-bold text-xs text-muted-foreground uppercase tracking-wider">Assigned Recruiter</Label>
            <Select value={assignedRecruiterUserId} onValueChange={setAssignedRecruiterUserId} disabled={pending}>
              <SelectTrigger className="h-10 bg-background">
                <SelectValue placeholder="Select recruiter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {employees
                  .filter((e) => e.user?.id)
                  .map((e) => (
                    <SelectItem key={e.user!.id} value={e.user!.id}>
                      {e.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Manager Assignment */}
          <div className="space-y-1.5">
            <Label className="font-bold text-xs text-muted-foreground uppercase tracking-wider">Assigned Manager</Label>
            <Select value={assignedManagerEmployeeId} onValueChange={setAssignedManagerEmployeeId} disabled={pending}>
              <SelectTrigger className="h-10 bg-background">
                <SelectValue placeholder="Select manager" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={String(e.id)}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Priority */}
          <div className="space-y-1.5">
            <Label className="font-bold text-xs text-muted-foreground uppercase tracking-wider">Priority</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as ApplicationPriority)} disabled={pending}>
              <SelectTrigger className="h-10 bg-background">
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                {Object.values(ApplicationPriority).map((p) => (
                  <SelectItem key={p} value={p}>
                    {p.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Source */}
          <div className="space-y-1.5">
            <Label className="font-bold text-xs text-muted-foreground uppercase tracking-wider">Source</Label>
            <Select value={source} onValueChange={(v) => setSource(v as CandidateSource)} disabled={pending}>
              <SelectTrigger className="h-10 bg-background">
                <SelectValue placeholder="Select source" />
              </SelectTrigger>
              <SelectContent>
                {Object.values(CandidateSource).map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replace(/_/g, " ").toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CandidateSection>

      <div className="flex justify-end gap-3 border-t border-border pt-6">
        <Button variant="outline" asChild disabled={pending}>
          <Link href="/admin/recruitment/pipeline">Cancel</Link>
        </Button>
        <Button type="submit" loading={pending} className="font-semibold shadow-subtle">
          {pending ? "Saving…" : mode === "create" ? "Create Application" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
