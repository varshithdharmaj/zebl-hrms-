"use client";

import React from "react";
import { format } from "date-fns";

export function OfferApprovalCard({ offer }: { offer: any }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-subtle space-y-6">
      <div className="border-b border-border pb-4">
        <h3 className="text-lg font-bold text-foreground">Approvals & Compliance</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Internal approval status for releasing the offer.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {/* Manager Approval */}
        <div className="rounded-xl border border-border p-4 bg-slate-50/50 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-foreground">Manager Approval</span>
            {offer.managerApprovedAt ? (
              <span className="inline-flex items-center rounded-full bg-green-50 border border-green-200 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                Approved
              </span>
            ) : offer.managerApprovalSkipped ? (
              <span className="inline-flex items-center rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                Skipped
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                Pending
              </span>
            )}
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            {offer.managerApprovedAt && (
              <div>
                Approved At: {format(new Date(offer.managerApprovedAt), "MMM dd, yyyy")}
              </div>
            )}
            {offer.managerApprovedByUserId && (
              <div>Approved By User ID: {offer.managerApprovedByUserId}</div>
            )}
            {!offer.managerApprovedAt && !offer.managerApprovalSkipped && (
              <div>Awaiting hiring manager review.</div>
            )}
          </div>
        </div>

        {/* HR Approval */}
        <div className="rounded-xl border border-border p-4 bg-slate-50/50 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-foreground">HR Approval</span>
            {offer.hrApprovedAt ? (
              <span className="inline-flex items-center rounded-full bg-green-50 border border-green-200 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                Approved
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                Pending
              </span>
            )}
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            {offer.hrApprovedAt && (
              <div>
                Approved At: {format(new Date(offer.hrApprovedAt), "MMM dd, yyyy")}
              </div>
            )}
            {offer.hrApprovedByUserId && (
              <div>Approved By User ID: {offer.hrApprovedByUserId}</div>
            )}
            {!offer.hrApprovedAt && (
              <div>Awaiting HR Admin final sign-off.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
