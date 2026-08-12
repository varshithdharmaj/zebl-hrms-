"use client";

import React, { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ErrorAlert } from "@/components/ui/error-alert";
import {
  applyResumeImportDraftAction,
  dismissResumeImportDraftAction,
} from "@/actions/recruitment-resume-import";
import type {
  ResumeImportDraftContent,
  ScalarFieldDiff,
  SectionDiff,
  FieldDiffStatus,
} from "@/lib/recruitment/resume-import";
import type { CandidateDetail } from "@/lib/recruitment/candidate/types";

type ScalarDecisionState = {
  action: "accept" | "ignore";
  editedValue: string;
  editing: boolean;
};

type SectionDecisionState = {
  action: "accept" | "ignore";
  editedJson: string;
  editing: boolean;
};

function statusBadgeClass(status: FieldDiffStatus | SectionDiff["status"]): string {
  switch (status) {
    case "new":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "changed":
      return "bg-amber-50 text-amber-800 border-amber-200";
    case "conflict":
      return "bg-orange-50 text-orange-800 border-orange-200";
    case "missing":
      return "bg-slate-100 text-slate-600 border-slate-200";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusBadgeClass(status as FieldDiffStatus)}`}
    >
      {status}
    </span>
  );
}

export function ResumeImportReview({
  draftId,
  candidateId,
  status,
  content,
  scalars,
  sections,
  candidateName,
}: {
  draftId: string;
  candidateId: string;
  status: string;
  content: ResumeImportDraftContent;
  scalars: ScalarFieldDiff[];
  sections: SectionDiff[];
  candidate: CandidateDetail;
  candidateName: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [scalarState, setScalarState] = useState<Record<string, ScalarDecisionState>>(
    () =>
      Object.fromEntries(
        scalars.map((s) => [
          s.key,
          {
            action: "ignore" as const,
            editedValue: s.imported ?? "",
            editing: false,
          },
        ])
      )
  );

  const [sectionState, setSectionState] = useState<Record<string, SectionDecisionState>>(
    () =>
      Object.fromEntries(
        sections.map((s) => [
          s.section,
          {
            action: "ignore" as const,
            editedJson: JSON.stringify(
              content.mapped[s.section] ?? [],
              null,
              2
            ),
            editing: false,
          },
        ])
      )
  );

  const isPendingReview = status === "pending_review";

  const personalScalars = useMemo(
    () => scalars.filter((s) => s.group === "personal"),
    [scalars]
  );
  const professionalScalars = useMemo(
    () => scalars.filter((s) => s.group === "professional"),
    [scalars]
  );

  const setScalarAction = (key: string, action: "accept" | "ignore") => {
    setScalarState((prev) => ({
      ...prev,
      [key]: { ...prev[key], action, editing: action === "accept" ? prev[key].editing : false },
    }));
  };

  const handleApply = () => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const scalarDecisions = Object.entries(scalarState).map(([key, state]) => ({
        key,
        action: state.action,
        ...(state.action === "accept" && state.editing
          ? { editedValue: state.editedValue }
          : {}),
      }));

      const sectionDecisions: Array<{
        section: SectionDiff["section"];
        action: "accept" | "ignore";
        editedRows?: Record<string, unknown>[];
      }> = [];

      for (const [section, state] of Object.entries(sectionState)) {
        let editedRows: Record<string, unknown>[] | undefined;
        if (state.action === "accept" && state.editing) {
          try {
            const parsed = JSON.parse(state.editedJson) as unknown;
            if (!Array.isArray(parsed)) {
              setError(`${section} must be a JSON array.`);
              return;
            }
            editedRows = parsed as Record<string, unknown>[];
          } catch {
            setError(`Invalid JSON for ${section}.`);
            return;
          }
        }
        sectionDecisions.push({
          section: section as SectionDiff["section"],
          action: state.action,
          ...(editedRows ? { editedRows } : {}),
        });
      }

      const res = await applyResumeImportDraftAction(
        {},
        {
          draftId,
          candidateId,
          scalarDecisions,
          sectionDecisions,
        }
      );

      if (res.error) {
        setError(res.error);
        return;
      }
      setSuccess(res.success ?? "Applied.");
      router.push(`/admin/recruitment/candidates/${candidateId}`);
      router.refresh();
    });
  };

  const handleDismiss = () => {
    setError(null);
    startTransition(async () => {
      const res = await dismissResumeImportDraftAction(
        {},
        { draftId, candidateId }
      );
      if (res.error) {
        setError(res.error);
        return;
      }
      router.push(`/admin/recruitment/candidates/${candidateId}`);
      router.refresh();
    });
  };

  const renderScalarGroup = (title: string, rows: ScalarFieldDiff[]) => (
    <div className="space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <div className="divide-y divide-border/60 rounded-xl border border-border bg-card overflow-hidden">
        {rows.map((row) => {
          const state = scalarState[row.key];
          return (
            <div key={row.key} className="grid gap-3 p-4 md:grid-cols-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{row.label}</p>
                  <StatusPill status={row.status} />
                </div>
                <p className="text-xs text-muted-foreground">Current</p>
                <p className="text-sm whitespace-pre-wrap break-words">
                  {row.current ?? "—"}
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Imported</p>
                {state?.editing ? (
                  row.key === "professionalSummary" ? (
                    <Textarea
                      value={state.editedValue}
                      onChange={(e) =>
                        setScalarState((prev) => ({
                          ...prev,
                          [row.key]: { ...prev[row.key], editedValue: e.target.value },
                        }))
                      }
                      rows={4}
                      disabled={!isPendingReview || isPending}
                    />
                  ) : (
                    <Input
                      value={state.editedValue}
                      onChange={(e) =>
                        setScalarState((prev) => ({
                          ...prev,
                          [row.key]: { ...prev[row.key], editedValue: e.target.value },
                        }))
                      }
                      disabled={!isPendingReview || isPending}
                    />
                  )
                ) : (
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {row.imported ?? "—"}
                  </p>
                )}
                {isPendingReview && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <Button
                      type="button"
                      size="sm"
                      variant={state?.action === "accept" ? "default" : "outline"}
                      disabled={isPending || !row.imported}
                      onClick={() => setScalarAction(row.key, "accept")}
                    >
                      Accept
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={state?.action === "ignore" ? "default" : "outline"}
                      disabled={isPending}
                      onClick={() => setScalarAction(row.key, "ignore")}
                    >
                      Keep current
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={isPending || !row.imported}
                      onClick={() =>
                        setScalarState((prev) => ({
                          ...prev,
                          [row.key]: {
                            ...prev[row.key],
                            action: "accept",
                            editing: !prev[row.key].editing,
                          },
                        }))
                      }
                    >
                      {state?.editing ? "Done editing" : "Edit"}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            Review buffer for <span className="font-semibold text-foreground">{candidateName}</span>
            {" · "}
            <span className="uppercase tracking-wide text-xs font-bold">{status.replace("_", " ")}</span>
            {content.source === "stub" && (
              <span className="ml-2 text-xs text-amber-700">Stub data (no parser)</span>
            )}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Default is keep current. Nothing is written until you apply accepted fields.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/recruitment/candidates/${candidateId}`}>Back to profile</Link>
          </Button>
          {isPendingReview && (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={handleDismiss}
              >
                Dismiss draft
              </Button>
              <Button size="sm" onClick={handleApply} loading={isPending}>
                {isPending ? "Applying…" : "Apply accepted"}
              </Button>
            </>
          )}
        </div>
      </div>

      {error && <ErrorAlert message={error} />}
      {success && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {success}
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-1">
        {renderScalarGroup("Personal", personalScalars)}
        {renderScalarGroup("Professional", professionalScalars)}

        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Nested sections
          </h3>
          <div className="space-y-4">
            {sections.map((section) => {
              const state = sectionState[section.section];
              return (
                <div
                  key={section.section}
                  className="rounded-xl border border-border bg-card p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-semibold">{section.label}</h4>
                    <StatusPill status={section.status} />
                    <span className="text-xs text-muted-foreground">
                      Current {section.currentCount} · Imported {section.importedCount}
                    </span>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Current</p>
                      <p className="whitespace-pre-wrap break-words">
                        {section.currentPreview}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Imported</p>
                      {state?.editing ? (
                        <Textarea
                          value={state.editedJson}
                          onChange={(e) =>
                            setSectionState((prev) => ({
                              ...prev,
                              [section.section]: {
                                ...prev[section.section],
                                editedJson: e.target.value,
                              },
                            }))
                          }
                          rows={8}
                          className="font-mono text-xs"
                          disabled={!isPendingReview || isPending}
                        />
                      ) : (
                        <p className="whitespace-pre-wrap break-words">
                          {section.importedPreview}
                        </p>
                      )}
                    </div>
                  </div>
                  {isPendingReview && (
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant={state?.action === "accept" ? "default" : "outline"}
                        disabled={isPending || section.importedCount === 0}
                        onClick={() =>
                          setSectionState((prev) => ({
                            ...prev,
                            [section.section]: {
                              ...prev[section.section],
                              action: "accept",
                            },
                          }))
                        }
                      >
                        Accept section
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={state?.action === "ignore" ? "default" : "outline"}
                        disabled={isPending}
                        onClick={() =>
                          setSectionState((prev) => ({
                            ...prev,
                            [section.section]: {
                              ...prev[section.section],
                              action: "ignore",
                              editing: false,
                            },
                          }))
                        }
                      >
                        Keep current
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={isPending || section.importedCount === 0}
                        onClick={() =>
                          setSectionState((prev) => ({
                            ...prev,
                            [section.section]: {
                              ...prev[section.section],
                              action: "accept",
                              editing: !prev[section.section].editing,
                            },
                          }))
                        }
                      >
                        {state?.editing ? "Done editing" : "Edit JSON"}
                      </Button>
                    </div>
                  )}
                  {state?.action === "accept" && (
                    <p className="text-xs text-amber-700">
                      Accepting replaces the entire {section.label.toLowerCase()} section with
                      the reviewed import rows.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
