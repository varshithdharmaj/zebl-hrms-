"use client";

import React from "react";
import { OfferStatus } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

export function OfferStatusBadge({ status }: { status: OfferStatus }) {
  const styles: Record<OfferStatus, string> = {
    [OfferStatus.draft]: "bg-slate-100 text-slate-700 border-slate-200",
    [OfferStatus.manager_approval]: "bg-amber-50 text-amber-700 border-amber-200",
    [OfferStatus.hr_approval]: "bg-yellow-50 text-yellow-700 border-yellow-200",
    [OfferStatus.released]: "bg-blue-50 text-blue-700 border-blue-200",
    [OfferStatus.accepted]: "bg-emerald-50 text-green-700 border-emerald-200",
    [OfferStatus.declined]: "bg-rose-50 text-red-700 border-rose-200",
    [OfferStatus.withdrawn]: "bg-gray-100 text-gray-600 border-gray-200",
  };

  const labels: Record<OfferStatus, string> = {
    [OfferStatus.draft]: "Draft",
    [OfferStatus.manager_approval]: "Manager Approval",
    [OfferStatus.hr_approval]: "HR Approval",
    [OfferStatus.released]: "Sent",
    [OfferStatus.accepted]: "Accepted",
    [OfferStatus.declined]: "Declined",
    [OfferStatus.withdrawn]: "Withdrawn",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold shadow-sm transition-colors",
        styles[status] || "bg-slate-100 text-slate-700 border-slate-200"
      )}
    >
      {labels[status] || status}
    </span>
  );
}
