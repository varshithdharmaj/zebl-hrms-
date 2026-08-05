"use client";

import React from "react";
import Link from "next/link";
import { OfferStatusBadge } from "./offer-status-badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

export function OfferTable({
  offers,
}: {
  offers: readonly any[];
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-subtle">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40 font-semibold text-muted-foreground">
            <th className="px-6 py-4">Offer #</th>
            <th className="px-6 py-4">Candidate</th>
            <th className="px-6 py-4">Job</th>
            <th className="px-6 py-4">Status</th>
            <th className="px-6 py-4">Revision</th>
            <th className="px-6 py-4">Joining Date</th>
            <th className="px-6 py-4">CTC</th>
            <th className="px-6 py-4">Expiry</th>
            <th className="px-6 py-4">Created</th>
            <th className="px-6 py-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {offers.map((offer) => {
            const candidate = offer.application?.candidate;
            const job = offer.application?.jobOpening;
            const revisionCount = offer.revisions?.length ?? 0;

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
                  <div className="font-semibold text-foreground">
                    {candidate ? `${candidate.firstName} ${candidate.lastName}` : "Unknown"}
                  </div>
                  <div className="text-xs text-muted-foreground">{candidate?.email}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="font-medium text-foreground">{job?.title || "N/A"}</div>
                  <div className="text-xs text-muted-foreground">{offer.department || "N/A"}</div>
                </td>
                <td className="px-6 py-4">
                  <OfferStatusBadge status={offer.status} />
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center rounded bg-slate-50 border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
                    v{revisionCount + 1}
                  </span>
                </td>
                <td className="px-6 py-4 text-muted-foreground">
                  {offer.joiningDate ? format(new Date(offer.joiningDate), "MMM dd, yyyy") : "N/A"}
                </td>
                <td className="px-6 py-4 font-semibold text-foreground">
                  {offer.ctc ? `${Number(offer.ctc).toLocaleString()} ${offer.currency}` : "N/A"}
                </td>
                <td className="px-6 py-4 text-muted-foreground">
                  {offer.expiresAt ? format(new Date(offer.expiresAt), "MMM dd, yyyy") : "N/A"}
                </td>
                <td className="px-6 py-4 text-muted-foreground">
                  {format(new Date(offer.createdAt), "MMM dd, yyyy")}
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
