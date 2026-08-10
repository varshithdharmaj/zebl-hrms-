"use client";

import React, { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createInterviewAction,
  updateInterviewAction,
} from "@/actions/recruitment-interviews";
import { Button } from "@/components/ui/button";
import { InterviewRoundType, InterviewStatus } from "@/generated/prisma/enums";
import type { InterviewDetail } from "@/lib/recruitment/repositories/interview-repository";

/** Edit defaults — fields this form reads from `InterviewDetail`. */
export type InterviewFormValues = Pick<
  InterviewDetail,
  | "id"
  | "applicationId"
  | "title"
  | "roundType"
  | "scheduledStart"
  | "scheduledEnd"
  | "location"
  | "meetingUrl"
  | "summary"
  | "panelists"
>;

/** Application selector options for create mode. */
export type InterviewApplicationOption = {
  id: string;
  candidate: { fullName: string } | null;
  jobOpening: { title: string } | null;
};

interface InterviewFormProps {
  mode: "create" | "edit";
  interview?: InterviewFormValues;
  applicationId?: string;
  applications?: readonly InterviewApplicationOption[];
  employees: { id: number; name: string }[];
}

export function InterviewForm({
  mode,
  interview,
  applicationId,
  applications = [],
  employees,
}: InterviewFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = React.useState<string | null>(null);

  // Form states
  const [selectedAppId, setSelectedAppId] = React.useState(
    interview?.applicationId ?? applicationId ?? applications[0]?.id ?? ""
  );
  const [title, setTitle] = React.useState(interview?.title ?? "");
  const [roundType, setRoundType] = React.useState(
    interview?.roundType ?? InterviewRoundType.technical
  );
  const [scheduledStart, setScheduledStart] = React.useState(
    interview?.scheduledStart
      ? new Date(interview.scheduledStart).toISOString().slice(0, 16)
      : ""
  );
  const [scheduledEnd, setScheduledEnd] = React.useState(
    interview?.scheduledEnd
      ? new Date(interview.scheduledEnd).toISOString().slice(0, 16)
      : ""
  );
  const [location, setLocation] = React.useState(interview?.location ?? "");
  const [meetingUrl, setMeetingUrl] = React.useState(interview?.meetingUrl ?? "");
  const [summary, setSummary] = React.useState(interview?.summary ?? "");
  const [panelistIds, setPanelistIds] = React.useState<number[]>(
    interview?.panelists.map((p) => p.employeeId) ?? []
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedAppId) {
      setError("Please select an application.");
      return;
    }
    if (!title.trim()) {
      setError("Please enter an interview title.");
      return;
    }
    if (!scheduledStart || !scheduledEnd) {
      setError("Please select start and end times.");
      return;
    }

    const payload = {
      id: interview?.id,
      applicationId: selectedAppId,
      title,
      roundType,
      status: InterviewStatus.scheduled,
      scheduledStart: new Date(scheduledStart).toISOString(),
      scheduledEnd: new Date(scheduledEnd).toISOString(),
      location,
      meetingUrl,
      summary,
      panelistEmployeeIds: panelistIds,
    };

    startTransition(async () => {
      const action = mode === "create" ? createInterviewAction : updateInterviewAction;
      const res = await action({}, payload);

      if (res.error) {
        setError(res.error);
      } else if (mode === "edit" && interview?.id) {
        router.push(`/admin/recruitment/interviews/${interview.id}`);
        router.refresh();
      } else if (applicationId || selectedAppId) {
        router.push(
          `/admin/recruitment/applications/${applicationId || selectedAppId}`
        );
        router.refresh();
      } else {
        router.push(`/admin/recruitment/interviews`);
        router.refresh();
      }
    });
  };

  const handlePanelistToggle = (empId: number) => {
    setPanelistIds((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-6 shadow-subtle space-y-5">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider border-b border-border pb-3">
          Interview Information
        </h3>

        <div className="grid gap-5 sm:grid-cols-2">
          {/* Application Selection (Only if create and no applicationId pre-selected) */}
          {mode === "create" && !applicationId ? (
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                Select Application
              </label>
              <select
                value={selectedAppId}
                onChange={(e) => setSelectedAppId(e.target.value)}
                className="w-full h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Select an active application...</option>
                {applications.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.candidate?.fullName ?? "Unknown"} - {app.jobOpening?.title ?? "—"}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
              Interview Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Technical Round 1"
              className="w-full h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
              Round Type
            </label>
            <select
              value={roundType}
              onChange={(e) => setRoundType(e.target.value as InterviewRoundType)}
              className="w-full h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value={InterviewRoundType.screening}>Screening</option>
              <option value={InterviewRoundType.hr}>HR Round</option>
              <option value={InterviewRoundType.technical}>Technical Round</option>
              <option value={InterviewRoundType.team_lead}>Team Lead Round</option>
              <option value={InterviewRoundType.manager}>Manager Round</option>
              <option value={InterviewRoundType.client}>Client Round</option>
              <option value={InterviewRoundType.other}>Other</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
              Scheduled Start
            </label>
            <input
              type="datetime-local"
              value={scheduledStart}
              onChange={(e) => setScheduledStart(e.target.value)}
              className="w-full h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
              Scheduled End
            </label>
            <input
              type="datetime-local"
              value={scheduledEnd}
              onChange={(e) => setScheduledEnd(e.target.value)}
              className="w-full h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
              Location / Room
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Conference Room A or Remote"
              className="w-full h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
              Meeting URL
            </label>
            <input
              type="url"
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
              placeholder="https://meet.google.com/..."
              className="w-full h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
              Interview Summary / Agenda
            </label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Describe the agenda, focus areas, or instructions for the interviewers..."
              rows={3}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
        </div>
      </div>

      {/* Panelists Selection */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-subtle space-y-4">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider border-b border-border pb-3">
          Interview Panel (Select Interviewers)
        </h3>
        <div className="grid gap-3 sm:grid-cols-3 max-h-[200px] overflow-y-auto p-1">
          {employees.map((emp) => {
            const isSelected = panelistIds.includes(emp.id);
            return (
              <button
                type="button"
                key={emp.id}
                onClick={() => handlePanelistToggle(emp.id)}
                className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                  isSelected
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border hover:bg-muted/15"
                }`}
              >
                <span className="text-xs font-bold text-foreground truncate">{emp.name}</span>
                <span
                  className={`h-4 w-4 rounded-full border flex items-center justify-center text-[10px] font-bold ${
                    isSelected ? "bg-primary border-primary text-white" : "border-muted-foreground/40"
                  }`}
                >
                  {isSelected ? "✓" : ""}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Buttons */}
      <div className="flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          className="font-semibold text-xs h-9 rounded-lg"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          loading={isPending}
          className="font-semibold text-xs h-9 rounded-lg shadow-subtle"
        >
          {isPending ? "Saving…" : mode === "create" ? "Schedule Interview" : "Update Interview"}
        </Button>
      </div>
    </form>
  );
}
