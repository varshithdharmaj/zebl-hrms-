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
  duplicateOfferAction,
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

export function OfferDetailActions({ offer, userRole }: { offer: any; userRole: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = React.useState<string | null>(null);

  // Dialog inputs
  const [declineReason, setDeclineReason] = React.useState("");
  const [withdrawReason, setWithdrawReason] = React.useState("");
  const [expiresAt, setExpiresAt] = React.useState("");

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
    setError(null);
    startTransition(async () => {
      const res = await declineOfferAction({}, { id: offer.id, reason: declineReason || null });
      if (res.error) setError(res.error);
      else router.refresh();
    });
  };

  const handleWithdraw = () => {
    setError(null);
    startTransition(async () => {
      const res = await withdrawOfferAction({}, { id: offer.id, reason: withdrawReason || null });
      if (res.error) setError(res.error);
      else router.refresh();
    });
  };

  const handleDuplicate = () => {
    setError(null);
    startTransition(async () => {
      const res = await duplicateOfferAction({}, { id: offer.id });
      if (res.error) setError(res.error);
      else if (res.offerId) router.push(`/admin/recruitment/offers/${res.offerId}`);
    });
  };

  const isHrOrAdmin = ["hr", "super_admin"].includes(userRole);

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {error && (
        <div className="w-full text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2 mb-2">
          {error}
        </div>
      )}

      {/* Edit Button (only for draft) */}
      {offer.status === OfferStatus.draft && (
        <Button
          variant="outline"
          size="sm"
          className="font-semibold text-xs rounded-lg shadow-subtle"
          onClick={() => router.push(`/admin/recruitment/offers/${offer.id}/edit`)}
          disabled={isPending}
        >
          Edit Draft
        </Button>
      )}

      {/* Send Offer Button (only for draft) */}
      {offer.status === OfferStatus.draft && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" className="font-semibold text-xs rounded-lg shadow-subtle" disabled={isPending}>
              Send Offer
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Send Offer Letter</AlertDialogTitle>
              <AlertDialogDescription>
                This will release the offer to the candidate. You can optionally set an expiration date.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                Offer Expiry Date
              </label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleSend}>Send Now</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Accept Offer Button (only for released/sent) */}
      {offer.status === OfferStatus.released && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" className="font-semibold text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-subtle" disabled={isPending}>
              Accept Offer
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Accept Offer</AlertDialogTitle>
              <AlertDialogDescription>
                Mark this offer as accepted by the candidate. This makes them eligible for employee conversion.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleAccept} className="bg-emerald-600 hover:bg-emerald-700 text-white">Accept</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Decline Offer Button (only for released/sent) */}
      {offer.status === OfferStatus.released && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="outline" className="font-semibold text-xs rounded-lg text-red-600 border-red-200 hover:bg-red-50 shadow-subtle" disabled={isPending}>
              Decline Offer
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Decline Offer</AlertDialogTitle>
              <AlertDialogDescription>
                Mark this offer as declined by the candidate. Please provide a reason.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                Reason for Declining
              </label>
              <textarea
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="e.g. Compensation too low, accepted another offer..."
                rows={3}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDecline} className="bg-red-600 hover:bg-red-700 text-white">Decline</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Withdraw Offer Button (only for released/sent, HR/Admin only) */}
      {offer.status === OfferStatus.released && isHrOrAdmin && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="ghost" className="font-semibold text-xs rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100" disabled={isPending}>
              Withdraw Offer
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Withdraw Offer</AlertDialogTitle>
              <AlertDialogDescription>
                Withdraw this offer from the candidate. Please provide a reason.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                Reason for Withdrawal
              </label>
              <textarea
                value={withdrawReason}
                onChange={(e) => setWithdrawReason(e.target.value)}
                placeholder="e.g. Business requirements changed, candidate unresponsive..."
                rows={3}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleWithdraw} className="bg-gray-600 hover:bg-gray-700 text-white">Withdraw</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Duplicate Offer Button (always available) */}
      <Button
        variant="ghost"
        size="sm"
        className="font-semibold text-xs rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100"
        onClick={handleDuplicate}
        disabled={isPending}
      >
        Duplicate Offer
      </Button>
    </div>
  );
}
