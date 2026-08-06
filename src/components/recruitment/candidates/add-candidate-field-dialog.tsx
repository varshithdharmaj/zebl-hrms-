"use client";

import React, { useEffect, useMemo, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateCandidateAction } from "@/actions/recruitment-candidates";
import type { CandidateDetail } from "@/lib/recruitment/candidate/types";
import {
  buildAddableFieldUpdatePayload,
  listMissingAddableFields,
  validateAddableFieldValue,
  type AddableFieldKey,
  type CandidateAddableFieldDef,
} from "@/lib/recruitment/candidate/addable-fields";
import { cn } from "@/lib/utils";

function FieldValueEditor({
  field,
  value,
  onChange,
  disabled,
}: {
  field: CandidateAddableFieldDef;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  if (field.inputType === "select") {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={`add-field-${field.key}`}>{field.label}</Label>
        <select
          id={`add-field-${field.key}`}
          className="flex h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        >
          <option value="">Select…</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {field.hint ? <p className="text-[11px] text-muted-foreground">{field.hint}</p> : null}
      </div>
    );
  }

  if (field.inputType === "textarea") {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={`add-field-${field.key}`}>{field.label}</Label>
        <Textarea
          id={`add-field-${field.key}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          disabled={disabled}
          autoFocus
          className="min-h-[96px] text-sm"
        />
        {field.hint ? <p className="text-[11px] text-muted-foreground">{field.hint}</p> : null}
      </div>
    );
  }

  const inputType =
    field.inputType === "money" || field.inputType === "number"
      ? "text"
      : field.inputType === "url"
        ? "url"
        : field.inputType === "date"
          ? "date"
          : "text";

  const inputMode =
    field.inputType === "money" || field.inputType === "number" ? "decimal" : undefined;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={`add-field-${field.key}`}>{field.label}</Label>
      <Input
        id={`add-field-${field.key}`}
        type={inputType}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        disabled={disabled}
        autoFocus
        className="h-9 text-sm"
      />
      {field.hint ? <p className="text-[11px] text-muted-foreground">{field.hint}</p> : null}
    </div>
  );
}

export function AddCandidateFieldDialog({
  candidate,
  open,
  onOpenChange,
  onSuccess,
}: {
  candidate: CandidateDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (message: string) => void;
}) {
  const missing = useMemo(() => listMissingAddableFields(candidate), [candidate]);
  const [selectedKey, setSelectedKey] = useState<AddableFieldKey | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selected = missing.find((f) => f.key === selectedKey) ?? null;

  useEffect(() => {
    if (!open) return;
    setError(null);
    setValue("");
    setSelectedKey(missing[0]?.key ?? null);
  }, [open, missing]);

  const handleSave = () => {
    if (!selected) return;
    const validationError = validateAddableFieldValue(selected, value);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    const payload = buildAddableFieldUpdatePayload(candidate.id, selected, value);

    startTransition(async () => {
      const result = await updateCandidateAction({}, payload);
      if (result.error) {
        setError(result.error);
        return;
      }
      onOpenChange(false);
      onSuccess?.(result.success ?? `${selected.label} added.`);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-4 p-5">
        <DialogHeader>
          <DialogTitle>Add Field</DialogTitle>
          <DialogDescription>
            Choose a missing detail to fill. Already completed fields stay hidden.
          </DialogDescription>
        </DialogHeader>

        {missing.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            All supported profile fields are already filled.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Missing fields ({missing.length})</Label>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                {missing.map((field) => {
                  const active = field.key === selectedKey;
                  return (
                    <button
                      key={field.key}
                      type="button"
                      disabled={isPending}
                      onClick={() => {
                        setSelectedKey(field.key);
                        setValue("");
                        setError(null);
                      }}
                      className={cn(
                        "rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors",
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-card text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                      )}
                    >
                      {field.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {selected ? (
              <FieldValueEditor
                field={selected}
                value={value}
                onChange={(next) => {
                  setValue(next);
                  setError(null);
                }}
                disabled={isPending}
              />
            ) : null}

            {error ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {error}
              </p>
            ) : null}

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs font-semibold"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="text-xs font-semibold"
                onClick={handleSave}
                disabled={isPending || !selected}
              >
                {isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function AddCandidateFieldButton({
  candidate,
  onSuccess,
}: {
  candidate: CandidateDetail;
  onSuccess?: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const missingCount = listMissingAddableFields(candidate).length;

  if (missingCount === 0) return null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 text-xs font-semibold"
        onClick={() => setOpen(true)}
      >
        <Plus className="h-3.5 w-3.5" />
        Add Field
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
          {missingCount}
        </span>
      </Button>
      <AddCandidateFieldDialog
        candidate={candidate}
        open={open}
        onOpenChange={setOpen}
        onSuccess={onSuccess}
      />
    </>
  );
}
