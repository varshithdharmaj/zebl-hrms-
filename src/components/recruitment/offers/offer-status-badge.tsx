"use client";

import React from "react";
import { OfferStatus } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

export interface OfferStatusBadgeProps {
  status: OfferStatus | string;
  expiresAt?: Date | string | null;
}

export function OfferStatusBadge({ status, expiresAt }: OfferStatusBadgeProps) {
  // Check virtual expiry state: released & past expiry date
  const isExpired = React.useMemo(() => {
    if (status !== OfferStatus.released && status !== "released") return false;
    if (!expiresAt) return false;
    const exp = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
    return !Number.isNaN(exp.getTime()) && exp.getTime() < Date.now();
  }, [status, expiresAt]);

  if (isExpired) {
    return (
      <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 shadow-sm">
        Expired
      </span>
    );
  }

  switch (status) {
    case OfferStatus.draft:
    case "draft":
      return (
        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 shadow-sm">
          Draft
        </span>
      );

    case OfferStatus.released:
    case "released":
      return (
        <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 shadow-sm">
          Released
        </span>
      );

    case OfferStatus.accepted:
    case "accepted":
      return (
        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 shadow-sm">
          Accepted
        </span>
      );

    case OfferStatus.declined:
    case "declined":
      return (
        <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 shadow-sm">
          Declined
        </span>
      );

    case OfferStatus.withdrawn:
    case "withdrawn":
      return (
        <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700 shadow-sm">
          Withdrawn
        </span>
      );

    default:
      return (
        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 shadow-sm">
          {String(status)}
        </span>
      );
  }
}
