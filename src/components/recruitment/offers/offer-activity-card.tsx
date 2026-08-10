"use client";

import React from "react";
import type { Offer } from "@/generated/prisma/client";

export function OfferActivityCard({
  offer,
}: {
  offer: Pick<Offer, "offerNotes">;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-subtle space-y-4">
      <div className="border-b border-border pb-4">
        <h3 className="text-lg font-bold text-foreground">Internal Notes</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Special terms, negotiation history, or other internal remarks.
        </p>
      </div>

      {offer.offerNotes ? (
        <div className="rounded-lg border border-border bg-slate-50/50 p-4 text-sm text-foreground whitespace-pre-line">
          {offer.offerNotes}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground py-2 text-center">
          No internal notes added for this offer.
        </div>
      )}
    </div>
  );
}
