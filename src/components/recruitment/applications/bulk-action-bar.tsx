"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RecruitmentPipelineStage } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ErrorAlert } from "@/components/ui/error-alert";
import { X } from "lucide-react";
import {
  bulkMoveApplicationsStageAction,
  bulkAssignRecruiterAction,
} from "@/actions/recruitment-applications";
import { STAGE_OPTIONS } from "@/components/recruitment/applications/application-pipeline-drawer";

export type BulkActionBarEmployeeOption = {
  id: number;
  name: string;
  user: { id: string; email: string } | null;
};

/**
 * Sticky bottom bar shown when the recruiter has selected 1+ rows in List
 * view. Only two actions are exposed here — Move Stage (non-terminal
 * stages only, via STAGE_OPTIONS) and Assign Recruiter — matching the
 * explicit safe/unsafe split: Reject, Hiring Decision, Offer creation, and
 * Conversion are single-candidate flows and are never offered here.
 */
export function BulkActionBar({
  selectedIds,
  employeeOptions,
  onDone,
  onClearSelection,
}: {
  selectedIds: string[];
  employeeOptions: BulkActionBarEmployeeOption[];
  /** Called after a bulk action succeeds — parent should router.refresh() and clear selection. */
  onDone: () => void;
  onClearSelection: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<RecruitmentPipelineStage | "">("");
  const [recruiterUserId, setRecruiterUserId] = useState<string>("");

  if (selectedIds.length === 0) return null;

  const handleMoveStage = () => {
    if (!stage) return;
    setError(null);
    startTransition(async () => {
      const res = await bulkMoveApplicationsStageAction(
        {},
        { ids: selectedIds, stage }
      );
      if (res.error) {
        setError(res.error);
        return;
      }
      setStage("");
      router.refresh();
      onDone();
    });
  };

  const handleAssignRecruiter = () => {
    if (!recruiterUserId) return;
    setError(null);
    startTransition(async () => {
      const res = await bulkAssignRecruiterAction(
        {},
        { ids: selectedIds, recruiterUserId: recruiterUserId === "unassign" ? null : recruiterUserId }
      );
      if (res.error) {
        setError(res.error);
        return;
      }
      setRecruiterUserId("");
      router.refresh();
      onDone();
    });
  };

  return (
    <div className="sticky bottom-4 z-30 mx-auto flex w-full max-w-3xl flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-elevated">
      {error ? <ErrorAlert message={error} /> : null}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-primary px-2 text-xs font-bold text-primary-foreground">
            {selectedIds.length}
          </span>
          <span className="text-sm font-semibold text-foreground">selected</span>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select value={stage} onValueChange={(v) => setStage(v as RecruitmentPipelineStage)}>
            <SelectTrigger className="h-9 w-[190px] bg-background text-xs" aria-label="Move to stage">
              <SelectValue placeholder="Move stage to…" />
            </SelectTrigger>
            <SelectContent>
              {STAGE_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="sm"
            className="h-9 text-xs font-semibold"
            disabled={!stage || isPending}
            onClick={handleMoveStage}
          >
            Move Stage
          </Button>

          <Select value={recruiterUserId} onValueChange={setRecruiterUserId}>
            <SelectTrigger className="h-9 w-[190px] bg-background text-xs" aria-label="Assign recruiter">
              <SelectValue placeholder="Assign recruiter…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassign">Unassign</SelectItem>
              {employeeOptions
                .filter((e) => e.user?.id)
                .map((e) => (
                  <SelectItem key={e.user!.id} value={e.user!.id}>
                    {e.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-9 text-xs font-semibold"
            disabled={!recruiterUserId || isPending}
            onClick={handleAssignRecruiter}
          >
            Assign Recruiter
          </Button>

          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-9 w-9 rounded-lg"
            onClick={onClearSelection}
            title="Clear selection"
            disabled={isPending}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
