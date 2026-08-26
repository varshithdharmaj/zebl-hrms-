"use client";

import { useState, useTransition, type ComponentType } from "react";
import {
  MoreVertical,
  Plus,
  Pencil,
  ChevronLeft,
  ChevronRight,
  Archive,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, usePopoverState } from "@/components/ui/popover";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { ErrorAlert } from "@/components/ui/error-alert";
import {
  renamePipelineStageAction,
  movePipelineStageAction,
  archivePipelineStageAction,
} from "@/actions/recruitment-job-stages";

export type StageColumnMenuStage = {
  id: string;
  label: string;
  isSystemStage: boolean;
  canMoveLeft: boolean;
  canMoveRight: boolean;
};

export function StageColumnMenu({
  stage,
  onAddBefore,
  onAddAfter,
  onChanged,
}: {
  stage: StageColumnMenuStage;
  onAddBefore: () => void;
  onAddAfter: () => void;
  /** Called after a rename/move/archive succeeds — parent should router.refresh(). */
  onChanged: () => void;
}) {
  const menu = usePopoverState();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(stage.label);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const closeMenu = () => {
    menu.setOpen(false);
    setRenaming(false);
    setRenameValue(stage.label);
  };

  const handleMove = (direction: "left" | "right") => {
    setError(null);
    startTransition(async () => {
      const res = await movePipelineStageAction({}, { stageId: stage.id, direction });
      if (res.error) {
        setError(res.error);
        return;
      }
      closeMenu();
      onChanged();
    });
  };

  const handleRenameSubmit = () => {
    const label = renameValue.trim();
    if (!label || label === stage.label) {
      setRenaming(false);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await renamePipelineStageAction({}, { stageId: stage.id, label });
      if (res.error) {
        setError(res.error);
        return;
      }
      closeMenu();
      onChanged();
    });
  };

  const handleArchive = () => {
    setError(null);
    startTransition(async () => {
      const res = await archivePipelineStageAction({}, { stageId: stage.id });
      setConfirmArchive(false);
      if (res.error) {
        setError(res.error);
        return;
      }
      closeMenu();
      onChanged();
    });
  };

  if (stage.isSystemStage) {
    return (
      <span
        className="inline-flex h-6 w-6 items-center justify-center text-muted-foreground/60"
        title="System stage — cannot be modified"
      >
        <Lock className="h-3.5 w-3.5" />
      </span>
    );
  }

  return (
    <>
      <Popover
        open={menu.open}
        onOpenChange={(open) => (open ? menu.setOpen(true) : closeMenu())}
        align="end"
        trigger={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 rounded-md"
            onClick={() => menu.setOpen(!menu.open)}
            title="Stage options"
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </Button>
        }
        contentClassName="w-56 p-1.5"
      >
        {error ? (
          <div className="mb-1.5">
            <ErrorAlert message={error} />
          </div>
        ) : null}

        {renaming ? (
          <div className="flex flex-col gap-2 p-1.5">
            <Input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRenameSubmit();
                if (e.key === "Escape") setRenaming(false);
              }}
              maxLength={60}
              className="h-8 text-sm"
            />
            <div className="flex justify-end gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setRenaming(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={isPending}
                onClick={handleRenameSubmit}
              >
                Save
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col">
            <MenuItem
              icon={Plus}
              label="Add stage before"
              onClick={() => {
                closeMenu();
                onAddBefore();
              }}
            />
            <MenuItem
              icon={Plus}
              label="Add stage after"
              onClick={() => {
                closeMenu();
                onAddAfter();
              }}
            />
            <MenuItem icon={Pencil} label="Rename stage" onClick={() => setRenaming(true)} />
            <MenuItem
              icon={ChevronLeft}
              label="Move left"
              disabled={!stage.canMoveLeft || isPending}
              onClick={() => handleMove("left")}
            />
            <MenuItem
              icon={ChevronRight}
              label="Move right"
              disabled={!stage.canMoveRight || isPending}
              onClick={() => handleMove("right")}
            />
            <div className="my-1 h-px bg-border" />
            <MenuItem
              icon={Archive}
              label="Archive stage"
              destructive
              disabled={isPending}
              onClick={() => {
                menu.setOpen(false);
                setConfirmArchive(true);
              }}
            />
          </div>
        )}
      </Popover>

      <AlertDialog
        isOpen={confirmArchive}
        onOpenChange={setConfirmArchive}
        title="Archive stage"
        description={`Archive "${stage.label}"? It will be removed from the board, but any candidates currently in it stay exactly where they are and remain in reports/history. This cannot be undone from the board.`}
        actionLabel="Archive"
        isActionDestructive
        isPending={isPending}
        onAction={handleArchive}
      />
    </>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  destructive = false,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        destructive
          ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
          : "text-foreground hover:bg-muted"
      }`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {label}
    </button>
  );
}
