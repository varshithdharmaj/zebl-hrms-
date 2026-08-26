"use client";

import { useEffect, useState, useTransition } from "react";
import { StageCategory } from "@/generated/prisma/enums";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ErrorAlert } from "@/components/ui/error-alert";
import { addPipelineStageAction } from "@/actions/recruitment-job-stages";
import {
  CUSTOM_STAGE_CATEGORY_OPTIONS,
  STAGE_CATEGORY_LABELS,
} from "@/lib/recruitment/shared/pipeline-stage-groups";

export function AddPipelineStageDialog({
  open,
  onOpenChange,
  jobOpeningId,
  afterStageId,
  beforeStageId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobOpeningId: string;
  /** Insert position — pass exactly one of these (or neither, to append at the end). */
  afterStageId?: string | null;
  beforeStageId?: string | null;
  /** Called after the stage is created — parent should router.refresh(). */
  onCreated: () => void;
}) {
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState<StageCategory>(StageCategory.SCREENING);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      setLabel("");
      setCategory(StageCategory.SCREENING);
      setError(null);
    }
  }, [open]);

  const handleSubmit = () => {
    const trimmed = label.trim();
    if (!trimmed) {
      setError("Stage name is required.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await addPipelineStageAction(
        {},
        {
          jobOpeningId,
          label: trimmed,
          category,
          afterStageId: afterStageId ?? undefined,
          beforeStageId: beforeStageId ?? undefined,
        }
      );
      if (res.error) {
        setError(res.error);
        return;
      }
      onOpenChange(false);
      onCreated();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Pipeline Stage</DialogTitle>
          <DialogDescription>
            Existing candidates stay in their current stage — the new stage starts empty.
          </DialogDescription>
        </DialogHeader>

        {error ? <ErrorAlert message={error} /> : null}

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="new-stage-name" className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Stage name
            </label>
            <Input
              id="new-stage-name"
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Technical Assessment"
              maxLength={60}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
            />
          </div>

          <div className="space-y-1.5">
            <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Category
            </span>
            <Select value={category} onValueChange={(v) => setCategory(v as StageCategory)}>
              <SelectTrigger className="bg-background" aria-label="Stage category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CUSTOM_STAGE_CATEGORY_OPTIONS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {STAGE_CATEGORY_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isPending} className="font-semibold">
            Add Stage
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
