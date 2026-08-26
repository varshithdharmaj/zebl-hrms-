"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MIN_REJECTION_COMMENT_LENGTH } from "@/lib/workflow/workflow-types";
import { ApprovalStatusCard } from "@/components/approval/approval-status-card";
import type { PublicApprovalView } from "@/lib/approval-tokens/token-types";

export function RejectionForm({
  view,
  signedToken,
}: {
  view: PublicApprovalView;
  signedToken: string;
}) {
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError(null);
    if (comment.trim().length < MIN_REJECTION_COMMENT_LENGTH) {
      setError(`Please provide at least ${MIN_REJECTION_COMMENT_LENGTH} characters explaining the rejection.`);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/approve/${encodeURIComponent(signedToken)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: comment.trim() }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        setError(data.error ?? "Rejection failed.");
        return;
      }
      setSuccess(data.message ?? "Leave request rejected.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 shadow-card text-center">
        <h1 className="text-xl font-semibold text-foreground">Rejection recorded</h1>
        <p className="mt-2 text-sm text-muted-foreground">{success}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ApprovalStatusCard view={view} />
      <div className="rounded-xl border border-border p-5">
        <h2 className="text-sm font-semibold text-foreground">Rejection reason (required)</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          A clear reason is required before this request can be rejected.
        </p>
        <Textarea
          className="mt-3 min-h-[120px]"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Explain why this leave cannot be approved…"
          maxLength={2000}
        />
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        <Button
          type="button"
          variant="destructive"
          className="mt-4 w-full sm:w-auto"
          disabled={loading}
          onClick={() => void submit()}
        >
          {loading ? "Submitting…" : "Confirm rejection"}
        </Button>
      </div>
    </div>
  );
}
