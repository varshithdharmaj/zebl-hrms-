"use client";

import React from "react";
import Link from "next/link";
import { OfferStatusBadge } from "./offer-status-badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

type OfferRow = {
  id: string;
  offerNumber?: string | null;
  status: string;
  sentAt?: Date | string | null;
  releasedAt?: Date | string | null;
  expiresAt?: Date | string | null;
  createdBy?: { email?: string | null } | null;
  application?: {
    candidate?: {
      id?: string;
      fullName?: string | null;
      firstName?: string | null;
      lastName?: string | null;
      email?: string | null;
    } | null;
    jobOpening?: { title?: string | null } | null;
  } | null;
};

function candidateName(candidate: OfferRow["application"] extends infer A
  ? A extends { candidate?: infer C }
    ? C
    : null
  : null): string {
  if (!candidate) return "Unknown";
  if (typeof candidate === "object" && candidate !== null && "fullName" in candidate && candidate.fullName) {
    return String(candidate.fullName);
  }
  if (typeof candidate === "object" && candidate !== null) {
    const first = "firstName" in candidate ? candidate.firstName : "";
    const last = "lastName" in candidate ? candidate.lastName : "";
    const name = `${first ?? ""} ${last ?? ""}`.trim();
    return name || "Unknown";
  }
  return "Unknown";
}

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, "MMM dd, yyyy");
}

export function OfferTable({ offers }: { offers: readonly OfferRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-subtle">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40 font-semibold text-muted-foreground">
            <th className="px-6 py-4">Offer Number</th>
            <th className="px-6 py-4">Candidate</th>
            <th className="px-6 py-4">Job</th>
            <th className="px-6 py-4">Status</th>
            <th className="px-6 py-4">Sent Date</th>
            <th className="px-6 py-4">Expires</th>
            <th className="px-6 py-4">Recruiter</th>
            <th className="px-6 py-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {offers.map((offer) => {
            const candidate = offer.application?.candidate;
            const job = offer.application?.jobOpening;
            const sent = offer.sentAt ?? offer.releasedAt;

            return (
              <tr key={offer.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-6 py-4 font-mono font-medium text-foreground">
                  <Link
                    href={`/admin/recruitment/offers/${offer.id}`}
                    className="hover:underline text-primary"
                  >
                    {offer.offerNumber || "N/A"}
                  </Link>
                </td>
                <td className="px-6 py-4">
                  <div className="font-semibold text-foreground">{candidateName(candidate)}</div>
                  <div className="text-xs text-muted-foreground">{candidate?.email ?? "—"}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="font-medium text-foreground">{job?.title || "N/A"}</div>
                </td>
                <td className="px-6 py-4">
                  <OfferStatusBadge status={offer.status} />
                </td>
                <td className="px-6 py-4 text-muted-foreground">{formatDate(sent)}</td>
                <td className="px-6 py-4 text-muted-foreground">{formatDate(offer.expiresAt)}</td>
                <td className="px-6 py-4 text-muted-foreground text-xs">
                  {offer.createdBy?.email ?? "—"}
                </td>
                <td className="px-6 py-4 text-right">
                  <Link href={`/admin/recruitment/offers/${offer.id}`}>
                    <Button variant="ghost" size="sm" className="font-semibold">
                      View
                    </Button>
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
