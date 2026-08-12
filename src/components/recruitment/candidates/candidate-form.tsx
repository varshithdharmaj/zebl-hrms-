"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createCandidateAction,
  updateCandidateAction,
  type RecruitmentCandidateActionState,
} from "@/actions/recruitment-candidates";
import type { CandidateDetail } from "@/lib/recruitment/candidate/types";
import {
  CandidateStatus,
  CandidateSource,
  PreferredWorkMode,
} from "@/generated/prisma/enums";
import { CANDIDATE_STATUS_LABELS, CANDIDATE_SOURCE_LABELS } from "@/lib/recruitment/candidate/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CandidateSection } from "@/components/recruitment/candidates/candidate-section";
import { ErrorAlert } from "@/components/ui/error-alert";

export type EmployeeOption = {
  id: number;
  name: string;
  employeeCode: string;
  department: string | null;
  user: { id: string; email: string } | null;
};

const initial: RecruitmentCandidateActionState = {};

const WORK_MODE_LABELS: Record<PreferredWorkMode, string> = {
  [PreferredWorkMode.remote]: "Remote",
  [PreferredWorkMode.hybrid]: "Hybrid",
  [PreferredWorkMode.onsite]: "Onsite",
};

function toDateInput(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function CandidateForm({
  mode,
  candidate,
  employees,
}: {
  mode: "create" | "edit";
  candidate?: CandidateDetail;
  employees: EmployeeOption[];
}) {
  const router = useRouter();
  const action = mode === "create" ? createCandidateAction : updateCandidateAction;
  const [state, formAction, pending] = useActionState(action, initial);

  const [status, setStatus] = useState<CandidateStatus>(candidate?.status ?? CandidateStatus.active);
  const [source, setSource] = useState<CandidateSource>(
    candidate?.source ?? CandidateSource.manual_upload
  );
  const [recruiterUserId, setRecruiterUserId] = useState<string>(
    candidate?.primaryRecruiterUserId ?? ""
  );
  const [referredByEmpId, setReferredByEmpId] = useState<string>(
    candidate?.referredByEmployeeId != null ? String(candidate.referredByEmployeeId) : ""
  );
  const [workMode, setWorkMode] = useState<string>(candidate?.preferredWorkMode ?? "");
  const [willingToRelocate, setWillingToRelocate] = useState<string>(
    candidate?.willingToRelocate == null ? "" : candidate.willingToRelocate ? "true" : "false"
  );

  useEffect(() => {
    if (state.success && state.candidateId) {
      router.push(`/admin/recruitment/candidates/${state.candidateId}`);
    }
  }, [state.success, state.candidateId, router]);

  const recruiterOptions = employees
    .filter((e) => e.user)
    .map((e) => ({ userId: e.user!.id, name: e.name, email: e.user!.email }));

  return (
    <form action={formAction} className="space-y-6">
      {mode === "edit" && candidate ? <input type="hidden" name="id" value={candidate.id} /> : null}
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="source" value={source} />
      <input type="hidden" name="primaryRecruiterUserId" value={recruiterUserId} />
      <input type="hidden" name="referredByEmployeeId" value={referredByEmpId} />
      <input type="hidden" name="preferredWorkMode" value={workMode} />
      <input type="hidden" name="willingToRelocate" value={willingToRelocate} />

      {state.error ? (
        <div className="space-y-2">
          <ErrorAlert message={state.error} />
          {state.duplicateCandidateId ? (
            <Button asChild variant="outline" size="sm" className="font-semibold">
              <Link href={`/admin/recruitment/candidates/${state.duplicateCandidateId}`}>
                Open Existing Candidate
              </Link>
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <CandidateSection title="Personal" description="Identity, contact, and location.">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="fullName" className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                  Full Name
                </Label>
                <Input
                  id="fullName"
                  name="fullName"
                  required
                  defaultValue={candidate?.fullName ?? ""}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="firstName" className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                  First Name
                </Label>
                <Input id="firstName" name="firstName" defaultValue={candidate?.firstName ?? ""} className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName" className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                  Last Name
                </Label>
                <Input id="lastName" name="lastName" defaultValue={candidate?.lastName ?? ""} className="h-10" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="preferredName" className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                  Preferred Name
                </Label>
                <Input
                  id="preferredName"
                  name="preferredName"
                  defaultValue={candidate?.preferredName ?? ""}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="email" className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                  Email
                </Label>
                <Input id="email" name="email" type="email" defaultValue={candidate?.email ?? ""} className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone" className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                  Phone
                </Label>
                <Input
                  id="phone"
                  name="phone"
                  placeholder="+1234567890"
                  defaultValue={candidate?.phone ?? ""}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="alternatePhone" className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                  Alternate Phone
                </Label>
                <Input
                  id="alternatePhone"
                  name="alternatePhone"
                  placeholder="+1234567890"
                  defaultValue={candidate?.alternatePhone ?? ""}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dateOfBirth" className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                  Date of Birth
                </Label>
                <Input
                  id="dateOfBirth"
                  name="dateOfBirth"
                  type="date"
                  defaultValue={toDateInput(candidate?.dateOfBirth)}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="location" className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                  Current Location
                </Label>
                <Input
                  id="location"
                  name="location"
                  placeholder="City, Country"
                  defaultValue={candidate?.location ?? ""}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="preferredLocation" className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                  Preferred Location
                </Label>
                <Input
                  id="preferredLocation"
                  name="preferredLocation"
                  placeholder="Preferred city or region"
                  defaultValue={candidate?.personal?.preferredLocation ?? ""}
                  className="h-10"
                />
              </div>
            </div>
          </CandidateSection>

          <CandidateSection title="Professional" description="Headline, summary, and online profiles.">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="headline" className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                  Headline
                </Label>
                <Input
                  id="headline"
                  name="headline"
                  placeholder="Senior React Developer | 5 Years | FinTech"
                  defaultValue={candidate?.headline ?? ""}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="professionalSummary" className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                  Professional Summary
                </Label>
                <Textarea
                  id="professionalSummary"
                  name="professionalSummary"
                  rows={4}
                  placeholder="Short professional summary for recruiters…"
                  defaultValue={candidate?.professionalSummary ?? ""}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="totalExperienceYears" className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                  Total Experience (Years)
                </Label>
                <Input
                  id="totalExperienceYears"
                  name="totalExperienceYears"
                  placeholder="e.g. 5 or 5.5"
                  defaultValue={candidate?.totalExperienceYears ?? ""}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="currentCompany" className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                  Current Company
                </Label>
                <Input
                  id="currentCompany"
                  name="currentCompany"
                  defaultValue={candidate?.currentCompany ?? ""}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="currentTitle" className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                  Current Designation
                </Label>
                <Input
                  id="currentTitle"
                  name="currentTitle"
                  defaultValue={candidate?.currentTitle ?? ""}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="githubUrl" className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                  GitHub
                </Label>
                <Input
                  id="githubUrl"
                  name="githubUrl"
                  type="url"
                  placeholder="https://github.com/…"
                  defaultValue={candidate?.githubUrl ?? ""}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="linkedinUrl" className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                  LinkedIn
                </Label>
                <Input
                  id="linkedinUrl"
                  name="linkedinUrl"
                  type="url"
                  placeholder="https://linkedin.com/in/…"
                  defaultValue={candidate?.linkedinUrl ?? ""}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="portfolioUrl" className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                  Portfolio / Website
                </Label>
                <Input
                  id="portfolioUrl"
                  name="portfolioUrl"
                  type="url"
                  placeholder="https://…"
                  defaultValue={candidate?.personal?.portfolioUrl ?? ""}
                  className="h-10"
                />
              </div>
            </div>
          </CandidateSection>

          <CandidateSection title="Compensation" description="CTC expectations and currency.">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="currentCtc" className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                  Current CTC
                </Label>
                <Input
                  id="currentCtc"
                  name="currentCtc"
                  placeholder="e.g. 1200000"
                  defaultValue={candidate?.currentCtc ?? ""}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="expectedCtc" className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                  Expected CTC
                </Label>
                <Input
                  id="expectedCtc"
                  name="expectedCtc"
                  placeholder="e.g. 1500000"
                  defaultValue={candidate?.expectedCtc ?? ""}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="currency" className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                  Currency
                </Label>
                <Input
                  id="currency"
                  name="currency"
                  maxLength={3}
                  defaultValue={candidate?.currency ?? "INR"}
                  className="h-10"
                />
              </div>
            </div>
          </CandidateSection>

          <CandidateSection title="Availability" description="Notice period and work preferences.">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="noticePeriodDays" className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                  Notice Period (Days)
                </Label>
                <Input
                  id="noticePeriodDays"
                  name="noticePeriodDays"
                  type="number"
                  min={0}
                  defaultValue={candidate?.noticePeriodDays ?? ""}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="earliestJoinDate" className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                  Earliest Joining
                </Label>
                <Input
                  id="earliestJoinDate"
                  name="earliestJoinDate"
                  type="date"
                  defaultValue={toDateInput(candidate?.earliestJoinDate)}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                  Preferred Work Mode
                </Label>
                <Select value={workMode || "none"} onValueChange={(v) => setWorkMode(v === "none" ? "" : v)}>
                  <SelectTrigger className="h-10 bg-background" aria-label="Preferred work mode">
                    <SelectValue placeholder="Select work mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    {Object.values(PreferredWorkMode).map((mode) => (
                      <SelectItem key={mode} value={mode}>
                        {WORK_MODE_LABELS[mode]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                  Willing To Relocate
                </Label>
                <Select
                  value={willingToRelocate || "none"}
                  onValueChange={(v) => setWillingToRelocate(v === "none" ? "" : v)}
                >
                  <SelectTrigger className="h-10 bg-background" aria-label="Willing to relocate">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    <SelectItem value="true">Yes</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="availabilityNotes" className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                  Availability Notes
                </Label>
                <Textarea
                  id="availabilityNotes"
                  name="availabilityNotes"
                  rows={2}
                  placeholder="Notice buyout, joining constraints, etc."
                  defaultValue={candidate?.availabilityNotes ?? ""}
                />
              </div>
            </div>
          </CandidateSection>
        </div>

        <div className="space-y-6">
          <CandidateSection title="Status & Source" description="ATS categorization.">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                  Candidate Status
                </Label>
                <Select value={status} onValueChange={(v) => setStatus(v as CandidateStatus)}>
                  <SelectTrigger className="h-10 bg-background" aria-label="Candidate status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(CandidateStatus).map((s) => (
                      <SelectItem key={s} value={s}>
                        {CANDIDATE_STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                  Candidate Source
                </Label>
                <Select value={source} onValueChange={(v) => setSource(v as CandidateSource)}>
                  <SelectTrigger className="h-10 bg-background" aria-label="Candidate source">
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(CandidateSource).map((s) => (
                      <SelectItem key={s} value={s}>
                        {CANDIDATE_SOURCE_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {status === CandidateStatus.do_not_hire && (
                <div className="space-y-1.5">
                  <Label htmlFor="doNotHireReason" className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                    Do Not Hire Reason
                  </Label>
                  <Textarea
                    id="doNotHireReason"
                    name="doNotHireReason"
                    rows={2}
                    defaultValue={candidate?.doNotHireReason ?? ""}
                  />
                </div>
              )}
            </div>
          </CandidateSection>

          <CandidateSection title="Assignment & Referral" description="Ownership and tracking.">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                  Primary Recruiter
                </Label>
                <Select
                  value={recruiterUserId || "none"}
                  onValueChange={(v) => setRecruiterUserId(v === "none" ? "" : v)}
                >
                  <SelectTrigger className="h-10 bg-background" aria-label="Primary recruiter">
                    <SelectValue placeholder="Select recruiter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {recruiterOptions.map((o) => (
                      <SelectItem key={o.userId} value={o.userId}>
                        {o.name} ({o.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                  Referred By Employee
                </Label>
                <Select
                  value={referredByEmpId || "none"}
                  onValueChange={(v) => setReferredByEmpId(v === "none" ? "" : v)}
                >
                  <SelectTrigger className="h-10 bg-background" aria-label="Referred by employee">
                    <SelectValue placeholder="Select employee" />
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
                <Label htmlFor="timezone" className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                  Timezone
                </Label>
                <Input
                  id="timezone"
                  name="timezone"
                  placeholder="e.g. Asia/Kolkata"
                  defaultValue={candidate?.timezone ?? ""}
                  className="h-10"
                />
              </div>
            </div>
          </CandidateSection>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 pt-4">
        <Button type="submit" loading={pending} className="h-10 px-6 font-semibold shadow-subtle">
          {pending ? "Saving…" : mode === "create" ? "Create candidate" : "Save changes"}
        </Button>
        <Button type="button" variant="outline" asChild className="h-10 px-6 font-semibold shadow-subtle">
          <Link
            href={
              candidate
                ? `/admin/recruitment/candidates/${candidate.id}`
                : "/admin/recruitment/candidates"
            }
          >
            Cancel
          </Link>
        </Button>
      </div>
    </form>
  );
}
