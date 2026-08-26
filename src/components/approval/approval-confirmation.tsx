"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ApprovalStatusCard } from "@/components/approval/approval-status-card";
import type { PublicApprovalView } from "@/lib/approval-tokens/token-types";

export function ApprovalConfirmation({
  view,
  signedToken,
}: {
  view: PublicApprovalView;
  signedToken: string;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submitApproval() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/approve/${encodeURIComponent(signedToken)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        setError(data.error ?? "Approval failed.");
        return;
      }
      setSuccess(data.message ?? "Leave request approved.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 shadow-card text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
          ✓
        </div>
        <h1 className="text-xl font-semibold text-foreground">Approval complete</h1>
        <p className="mt-2 text-sm text-muted-foreground">{success}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ApprovalStatusCard view={view} />
      {!confirmed ? (
        <div className="rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-foreground">Confirm approval</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Review the leave details above. Approval is recorded only after you confirm.
          </p>
          <Button type="button" className="mt-4" onClick={() => setConfirmed(true)}>
            Continue to approve
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-5">
          <p className="text-sm text-foreground">
            You are about to approve this leave request. This action cannot be undone from this
            page.
          </p>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
          <div className="mt-4 flex flex-wrap gap-3">
            <Button type="button" disabled={loading} onClick={() => void submitApproval()}>
              {loading ? "Processing…" : "Confirm approval"}
            </Button>
            <Button type="button" variant="outline" disabled={loading} onClick={() => setConfirmed(false)}>
              Back
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
