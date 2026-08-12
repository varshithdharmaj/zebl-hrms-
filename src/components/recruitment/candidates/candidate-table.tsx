"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CandidateListItem } from "@/lib/recruitment/candidate/types";
import { CandidateStatusBadge } from "./candidate-status-badge";
import { CandidateSourceBadge } from "./candidate-source-badge";
import { CandidateAvatar } from "./candidate-avatar";
import { CandidateEmptyState } from "./candidate-empty-state";
import { Button } from "@/components/ui/button";
import { DataTable, DataTableCell, DataTableRow } from "@/components/ui/data-table";
import { ErrorAlert } from "@/components/ui/error-alert";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog } from "@/components/ui/alert-dialog";
import {
  archiveCandidateAction,
  restoreCandidateAction,
} from "@/actions/recruitment-candidates";
import {
  User,
  Mail,
  Phone,
  Copy,
  Check,
  Archive,
  RotateCcw,
  Eye,
  Edit,
  Download,
} from "lucide-react";

function formatDate(value: Date | string | null): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function CandidateTable({
  candidates,
  employeeOptions,
}: {
  candidates: CandidateListItem[];
  employeeOptions: { id: number; name: string; user: { id: string; email: string } | null }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedType, setCopiedType] = useState<"email" | "phone" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // AlertDialog configuration state
  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    actionLabel?: string;
    onAction: () => void;
    isDestructive?: boolean;
  } | null>(null);

  const employeeMap = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const emp of employeeOptions) {
      if (emp.user?.id) {
        map.set(emp.user.id, emp.name);
      }
    }
    return map;
  }, [employeeOptions]);

  if (candidates.length === 0) {
    return (
      <CandidateEmptyState
        icon={User}
        title="No candidates found"
        description="Add a candidate profile or adjust your filters to start tracking their recruitment journey."
        actionLabel="Add candidate"
        actionHref="/admin/recruitment/candidates/new"
      />
    );
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(candidates.map((c) => c.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }
    setSelectedIds(next);
  };

  const handleCopy = (id: string, text: string | null, type: "email" | "phone") => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setCopiedType(type);
    setTimeout(() => {
      setCopiedId(null);
      setCopiedType(null);
    }, 2000);
  };

  const handleSingleArchive = (id: string, name: string) => {
    setAlertConfig({
      isOpen: true,
      title: "Archive Candidate",
      description: `Are you sure you want to archive ${name}? This will move them to the archived status.`,
      actionLabel: "Archive",
      isDestructive: true,
      onAction: () => {
        setError(null);
        setSuccess(null);
        startTransition(async () => {
          const res = await archiveCandidateAction({}, { id });
          if (res.error) {
            setError(res.error);
          } else {
            setSuccess(res.success ?? "Candidate archived successfully.");
            router.refresh();
          }
        });
      },
    });
  };

  const handleSingleRestore = (id: string, name: string) => {
    setAlertConfig({
      isOpen: true,
      title: "Restore Candidate",
      description: `Are you sure you want to restore ${name}? This will return them to active status.`,
      actionLabel: "Restore",
      isDestructive: false,
      onAction: () => {
        setError(null);
        setSuccess(null);
        startTransition(async () => {
          const res = await restoreCandidateAction({}, { id });
          if (res.error) {
            setError(res.error);
          } else {
            setSuccess(res.success ?? "Candidate restored successfully.");
            router.refresh();
          }
        });
      },
    });
  };

  const handleBulkArchive = () => {
    if (selectedIds.size === 0) return;
    setAlertConfig({
      isOpen: true,
      title: "Bulk Archive Candidates",
      description: `Are you sure you want to archive all ${selectedIds.size} selected candidates?`,
      actionLabel: "Archive All",
      isDestructive: true,
      onAction: () => {
        setError(null);
        setSuccess(null);
        startTransition(async () => {
          let successCount = 0;
          let failMessage = null;

          for (const id of selectedIds) {
            const res = await archiveCandidateAction({}, { id });
            if (res.error) {
              failMessage = res.error;
            } else {
              successCount++;
            }
          }

          if (successCount > 0) {
            setSuccess(`Successfully archived ${successCount} candidates.`);
            setSelectedIds(new Set());
            router.refresh();
          }
          if (failMessage) {
            setError(`Failed to archive some candidates: ${failMessage}`);
          }
        });
      },
    });
  };

  const handleBulkRestore = () => {
    if (selectedIds.size === 0) return;
    setAlertConfig({
      isOpen: true,
      title: "Bulk Restore Candidates",
      description: `Are you sure you want to restore all ${selectedIds.size} selected candidates?`,
      actionLabel: "Restore All",
      isDestructive: false,
      onAction: () => {
        setError(null);
        setSuccess(null);
        startTransition(async () => {
          let successCount = 0;
          let failMessage = null;

          for (const id of selectedIds) {
            const res = await restoreCandidateAction({}, { id });
            if (res.error) {
              failMessage = res.error;
            } else {
              successCount++;
            }
          }

          if (successCount > 0) {
            setSuccess(`Successfully restored ${successCount} candidates.`);
            setSelectedIds(new Set());
            router.refresh();
          }
          if (failMessage) {
            setError(`Failed to restore some candidates: ${failMessage}`);
          }
        });
      },
    });
  };

  const handleBulkExportPlaceholder = () => {
    setAlertConfig({
      isOpen: true,
      title: "Bulk Export Candidates",
      description: "Bulk export is a placeholder and will be fully implemented in a future phase.",
      actionLabel: "Close",
      isDestructive: false,
      onAction: () => {},
    });
  };

  const allSelected = candidates.length > 0 && selectedIds.size === candidates.length;

  return (
    <div className="space-y-4">
      {error && <ErrorAlert message={error} />}
      {success && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/30 dark:bg-emerald-500/10 dark:text-emerald-400">
          {success}
        </p>
      )}

      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-4 py-3 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="text-sm font-semibold text-foreground">
            {selectedIds.size} candidate{selectedIds.size > 1 ? "s" : ""} selected
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkArchive}
              loading={isPending}
              className="flex items-center gap-1.5 font-medium shadow-subtle hover:text-danger hover:border-danger/30"
            >
              <Archive className="h-4 w-4" />
              Bulk Archive
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkRestore}
              loading={isPending}
              className="flex items-center gap-1.5 font-medium shadow-subtle hover:text-emerald-600 hover:border-emerald-600/30"
            >
              <RotateCcw className="h-4 w-4" />
              Bulk Restore
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkExportPlaceholder}
              disabled={isPending}
              className="flex items-center gap-1.5 font-medium shadow-subtle"
            >
              <Download className="h-4 w-4" />
              Bulk Export
            </Button>
          </div>
        </div>
      )}

      <div className="border border-border rounded-xl overflow-hidden shadow-subtle bg-card">
        <DataTable
          columns={[
            <Checkbox
              checked={allSelected}
              onCheckedChange={(checked) => handleSelectAll(!!checked)}
              aria-label="Select all candidates"
              key="select-all"
            />,
            "Candidate Name",
            "Current Position",
            "Contact",
            "Status",
            "Source",
            "Recruiter",
            "Updated",
            "Actions",
          ]}
        >
          {candidates.map((cand) => {
            const isSelected = selectedIds.has(cand.id);

            return (
              <DataTableRow key={cand.id} className={isSelected ? "bg-muted/30" : ""}>
                <DataTableCell className="w-10">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(checked) => handleSelectRow(cand.id, !!checked)}
                    aria-label={`Select ${cand.fullName}`}
                  />
                </DataTableCell>
                <DataTableCell>
                  <div className="flex items-center gap-3">
                    <CandidateAvatar fullName={cand.fullName} />
                    <div>
                      <Link
                        href={`/admin/recruitment/candidates/${cand.id}`}
                        className="font-semibold text-foreground hover:text-primary hover:underline transition-colors"
                      >
                        {cand.fullName}
                      </Link>
                      {cand.headline ? (
                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{cand.headline}</p>
                      ) : null}
                    </div>
                  </div>
                </DataTableCell>
                <DataTableCell>
                  <div>
                    <p className="font-semibold text-foreground text-sm">{cand.currentTitle ?? "—"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{cand.currentCompany ?? "—"}</p>
                  </div>
                </DataTableCell>
                <DataTableCell>
                  <div className="space-y-1">
                    {cand.email ? (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Mail className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate max-w-[150px]">{cand.email}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(cand.id, cand.email, "email")}
                          className="text-muted-foreground hover:text-foreground p-0.5 rounded hover:bg-muted transition-colors"
                          title="Copy email"
                        >
                          {copiedId === cand.id && copiedType === "email" ? (
                            <Check className="h-3 w-3 text-emerald-600" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    ) : null}
                    {cand.phone ? (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        <span>{cand.phone}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(cand.id, cand.phone, "phone")}
                          className="text-muted-foreground hover:text-foreground p-0.5 rounded hover:bg-muted transition-colors"
                          title="Copy phone"
                        >
                          {copiedId === cand.id && copiedType === "phone" ? (
                            <Check className="h-3 w-3 text-emerald-600" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </DataTableCell>
                <DataTableCell>
                  <CandidateStatusBadge status={cand.status} />
                </DataTableCell>
                <DataTableCell>
                  <CandidateSourceBadge source={cand.source} />
                </DataTableCell>
                <DataTableCell>
                  <span className="text-sm font-medium text-foreground">
                    {cand.primaryRecruiterUserId ? employeeMap.get(cand.primaryRecruiterUserId) ?? "—" : "—"}
                  </span>
                </DataTableCell>
                <DataTableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {formatDate(cand.updatedAt)}
                </DataTableCell>
                <DataTableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" asChild title="View Details" className="h-8 w-8 rounded-lg">
                      <Link href={`/admin/recruitment/candidates/${cand.id}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button variant="ghost" size="icon" asChild title="Edit Profile" className="h-8 w-8 rounded-lg">
                      <Link href={`/admin/recruitment/candidates/${cand.id}/edit`}>
                        <Edit className="h-4 w-4" />
                      </Link>
                    </Button>
                    {cand.status !== "archived" ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleSingleArchive(cand.id, cand.fullName)}
                        disabled={isPending}
                        title="Archive"
                        className="h-8 w-8 rounded-lg text-muted-foreground hover:text-danger hover:bg-danger-muted/30"
                      >
                        <Archive className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleSingleRestore(cand.id, cand.fullName)}
                        disabled={isPending}
                        title="Restore"
                        className="h-8 w-8 rounded-lg text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50/50"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </DataTableCell>
              </DataTableRow>
            );
          })}
        </DataTable>
      </div>

      {alertConfig && (
        <AlertDialog
          isOpen={alertConfig.isOpen}
          onOpenChange={(open) => setAlertConfig(open ? alertConfig : null)}
          title={alertConfig.title}
          description={alertConfig.description}
          actionLabel={alertConfig.actionLabel}
          isActionDestructive={alertConfig.isDestructive}
          isPending={isPending}
          onAction={() => {
            alertConfig.onAction();
            setAlertConfig(null);
          }}
        />
      )}
    </div>
  );
}
