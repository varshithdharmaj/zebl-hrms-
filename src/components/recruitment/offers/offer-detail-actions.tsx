"use client";

import React, { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { OfferStatus } from "@/generated/prisma/enums";
import {
  sendOfferAction,
  acceptOfferAction,
  declineOfferAction,
  withdrawOfferAction,
  generateOfferLetterAction,
} from "@/actions/recruitment-offers";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export interface OfferDetailActionsProps {
  offer: {
    id: string;
    status: OfferStatus | string;
    offerPdfKey?: string | null;
    releasedAt?: Date | string | null;
    acceptedAt?: Date | string | null;
    declinedAt?: Date | string | null;
    withdrawnAt?: Date | string | null;
    declineReason?: string | null;
    withdrawReason?: string | null;
  };
  userRole?: string;
}

function formatDate(dateVal?: Date | string | null): string {
  if (!dateVal) return "";
  const d = typeof dateVal === "string" ? new Date(dateVal) : dateVal;
  return Number.isNaN(d.getTime()) ? String(dateVal) : d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function OfferDetailActions({ offer }: OfferDetailActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const [declineReason, setDeclineReason] = React.useState("");
  const [withdrawReason, setWithdrawReason] = React.useState("");
  const [expiresAt, setExpiresAt] = React.useState("");

  const handleGeneratePdf = () => {
    setError(null);
    startTransition(async () => {
      const res = await generateOfferLetterAction({}, { id: offer.id });
      if (res.error) setError(res.error);
      else router.refresh();
    });
  };

  const handleSend = () => {
    setError(null);
    startTransition(async () => {
      const res = await sendOfferAction({}, { id: offer.id, expiresAt: expiresAt || null });
      if (res.error) setError(res.error);
      else router.refresh();
    });
  };

  const handleAccept = () => {
    setError(null);
    startTransition(async () => {
      const res = await acceptOfferAction({}, { id: offer.id });
      if (res.error) setError(res.error);
      else router.refresh();
    });
  };

  const handleDecline = () => {
    if (!declineReason.trim()) {
      setError("Please provide a reason for declining.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await declineOfferAction({}, { id: offer.id, reason: declineReason.trim() });
      if (res.error) setError(res.error);
      else router.refresh();
    });
  };

  const handleWithdraw = () => {
    if (!withdrawReason.trim()) {
      setError("Please provide a reason for withdrawal.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await withdrawOfferAction({}, { id: offer.id, reason: withdrawReason.trim() });
      if (res.error) setError(res.error);
      else router.refresh();
    });
  };

  return (
    <div className="space-y-2">
      {error && (
        <div className="text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5">
          {error}
        </div>
      )}

      {/* DRAFT STATE */}
      {offer.status === OfferStatus.draft && (
        <div className="flex flex-wrap gap-2 items-center">
          <Button
            variant="outline"
            size="sm"
            className="font-semibold text-xs rounded-lg shadow-subtle"
            onClick={() => router.push(`/admin/recruitment/offers/${offer.id}/edit`)}
            disabled={isPending}
          >
            Edit Draft
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="font-semibold text-xs rounded-lg shadow-subtle"
            onClick={handleGeneratePdf}
            disabled={isPending}
          >
            {isPending ? "Generating…" : "Generate PDF"}
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                className="font-semibold text-xs rounded-lg shadow-subtle"
                disabled={isPending || !offer.offerPdfKey}
                title={!offer.offerPdfKey ? "Generate PDF before sending the offer." : undefined}
              >
                Send Offer
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Send Offer Letter</AlertDialogTitle>
                <AlertDialogDescription>
                  This emails the generated offer letter PDF to the candidate and releases the offer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="py-4">
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Expiration Date (Optional)
                </label>
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-full h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleSend}>Send Now</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {/* RELEASED STATE */}
      {offer.status === OfferStatus.released && (
        <div className="flex flex-wrap gap-2 items-center">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                className="font-semibold text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-subtle"
                disabled={isPending}
              >
                Accept & Convert to Employee
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Accept Offer & Create Employee</AlertDialogTitle>
                <AlertDialogDescription>
                  Mark this offer as accepted by candidate and automatically create their Employee record in a single transaction.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleAccept} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  Accept & Convert
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="font-semibold text-xs rounded-lg text-red-600 border-red-200 hover:bg-red-50 shadow-subtle"
                disabled={isPending}
              >
                Decline Offer
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Decline Offer</AlertDialogTitle>
                <AlertDialogDescription>
                  Mark this offer as declined. Please enter the decline reason.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="py-4">
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Decline Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  placeholder="Reason candidate declined..."
                  rows={3}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDecline} className="bg-red-600 hover:bg-red-700 text-white">
                  Confirm Decline
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="font-semibold text-xs rounded-lg text-slate-600 hover:bg-slate-100"
                disabled={isPending}
              >
                Withdraw Offer
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Withdraw Offer</AlertDialogTitle>
                <AlertDialogDescription>
                  Withdraw this released offer. Please enter the withdrawal reason.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="py-4">
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Withdraw Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={withdrawReason}
                  onChange={(e) => setWithdrawReason(e.target.value)}
                  placeholder="Reason offer is being withdrawn..."
                  rows={3}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleWithdraw} className="bg-slate-700 hover:bg-slate-800 text-white">
                  Confirm Withdrawal
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {/* ACCEPTED STATE BANNER */}
      {offer.status === OfferStatus.accepted && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5 text-xs text-emerald-900 shadow-subtle flex flex-col gap-1">
          <div className="font-semibold flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Offer Accepted {offer.acceptedAt ? `on ${formatDate(offer.acceptedAt)}` : ""}
          </div>
          <p className="text-emerald-700">Candidate accepted terms. Employee profile automatically created.</p>
        </div>
      )}

      {/* DECLINED STATE BANNER */}
      {offer.status === OfferStatus.declined && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3.5 text-xs text-rose-900 shadow-subtle flex flex-col gap-1">
          <div className="font-semibold flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            Offer Declined {offer.declinedAt ? `on ${formatDate(offer.declinedAt)}` : ""}
          </div>
          {offer.declineReason && (
            <p className="text-rose-700">
              <span className="font-medium">Reason:</span> {offer.declineReason}
            </p>
          )}
        </div>
      )}

      {/* WITHDRAWN STATE BANNER */}
      {offer.status === OfferStatus.withdrawn && (
        <div className="rounded-xl border border-slate-300 bg-slate-100/90 p-3.5 text-xs text-slate-800 shadow-subtle flex flex-col gap-1">
          <div className="font-semibold flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-slate-500" />
            Offer Withdrawn {offer.withdrawnAt ? `on ${formatDate(offer.withdrawnAt)}` : ""}
          </div>
          {offer.withdrawReason && (
            <p className="text-slate-600">
              <span className="font-medium">Reason:</span> {offer.withdrawReason}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
