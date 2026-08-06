"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createOfferRevisionAction } from "@/actions/recruitment-offers";
import { format } from "date-fns";

type Revision = {
  id: string;
  version: number;
  changeNote?: string | null;
  createdAt: Date | string;
  snapshotJson?: Record<string, unknown> | null;
};

export function OfferRevisionPanel({
  offerId,
  revisions,
  canRevise,
}: {
  offerId: string;
  revisions: readonly Revision[];
  canRevise: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [changeNote, setChangeNote] = useState("");
  const [ctc, setCtc] = useState("");
  const [baseSalary, setBaseSalary] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleRevise = () => {
    if (!changeNote.trim()) {
      setError("Change note is required.");
      return;
    }
    setError(null);
    setSuccess(null);

    const patch: Record<string, number> = {};
    if (ctc.trim()) patch.ctc = Number(ctc);
    if (baseSalary.trim()) patch.baseSalary = Number(baseSalary);

    startTransition(async () => {
      const res = await createOfferRevisionAction(
        {},
        {
          id: offerId,
          changeNote: changeNote.trim(),
          patch,
        }
      );
      if (res.error) {
        setError(res.error);
      } else {
        setSuccess("Revision saved. Offer is back in draft.");
        setOpen(false);
        setChangeNote("");
        setCtc("");
        setBaseSalary("");
        router.refresh();
      }
    });
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-subtle space-y-4">
      <div className="flex items-start justify-between gap-3 border-b border-border pb-4">
        <div>
          <h3 className="text-lg font-bold text-foreground">Revision History</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Previous revisions are read-only. Latest package becomes the active draft after revise.
          </p>
        </div>
        {canRevise ? (
          <Button
            size="sm"
            variant="outline"
            className="font-semibold text-xs"
            onClick={() => setOpen((v) => !v)}
            disabled={isPending}
          >
            {open ? "Cancel" : "Revise Offer"}
          </Button>
        ) : null}
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          {success}
        </p>
      )}

      {open ? (
        <div className="space-y-3 rounded-lg border border-border bg-muted/10 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="changeNote" className="text-xs font-bold uppercase tracking-wider">
              Change note
            </Label>
            <Input
              id="changeNote"
              value={changeNote}
              onChange={(e) => setChangeNote(e.target.value)}
              placeholder="e.g. Adjusted CTC after negotiation"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rev-ctc" className="text-xs font-bold uppercase tracking-wider">
                New CTC (optional)
              </Label>
              <Input
                id="rev-ctc"
                type="number"
                value={ctc}
                onChange={(e) => setCtc(e.target.value)}
                placeholder="Leave blank to keep"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rev-base" className="text-xs font-bold uppercase tracking-wider">
                New Base Salary (optional)
              </Label>
              <Input
                id="rev-base"
                type="number"
                value={baseSalary}
                onChange={(e) => setBaseSalary(e.target.value)}
                placeholder="Leave blank to keep"
              />
            </div>
          </div>
          <Button
            size="sm"
            className="font-semibold"
            onClick={handleRevise}
            disabled={isPending}
          >
            {isPending ? "Saving…" : "Save Revision"}
          </Button>
        </div>
      ) : null}

      {revisions.length === 0 ? (
        <p className="text-xs text-muted-foreground">No revisions yet.</p>
      ) : (
        <ul className="space-y-3">
          {revisions.map((rev) => (
            <li
              key={rev.id}
              className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-foreground">v{rev.version}</span>
                <span className="text-muted-foreground">
                  {format(new Date(rev.createdAt), "MMM dd, yyyy HH:mm")}
                </span>
              </div>
              <p className="mt-1 text-muted-foreground">{rev.changeNote || "No note"}</p>
              {rev.snapshotJson && typeof rev.snapshotJson === "object" ? (
                <p className="mt-1 font-mono text-[10px] text-muted-foreground/80">
                  Snapshot CTC:{" "}
                  {String(
                    (rev.snapshotJson as { ctc?: string | null }).ctc ?? "—"
                  )}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
