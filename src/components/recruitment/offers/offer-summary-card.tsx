"use client";

import React from "react";
import { format } from "date-fns";

export function OfferSummaryCard({ offer }: { offer: any }) {
  const candidate = offer.application?.candidate;
  const job = offer.application?.jobOpening;

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-subtle space-y-6">
      <div className="border-b border-border pb-4">
        <h3 className="text-lg font-bold text-foreground">Offer Summary</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Key candidate, job, and employment details.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {/* Candidate Summary */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Candidate
          </h4>
          {candidate ? (
            <div>
              <div className="font-semibold text-foreground text-base">
                {candidate.firstName} {candidate.lastName}
              </div>
              <div className="text-sm text-muted-foreground mt-0.5">{candidate.email}</div>
              <div className="text-sm text-muted-foreground">{candidate.phone || "No Phone"}</div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No candidate linked.</div>
          )}
        </div>

        {/* Job Summary */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Job Opening
          </h4>
          {job ? (
            <div>
              <div className="font-semibold text-foreground text-base">{job.title}</div>
              <div className="text-sm text-muted-foreground mt-0.5">
                Department: {offer.department || "N/A"}
              </div>
              <div className="text-sm text-muted-foreground">Location: {offer.location || "N/A"}</div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No job opening linked.</div>
          )}
        </div>
      </div>

      <div className="grid gap-4 border-t border-border pt-6 sm:grid-cols-2 md:grid-cols-3">
        <div>
          <span className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
            Employment Type
          </span>
          <span className="font-semibold text-foreground text-sm">
            {offer.employmentType || "Full-time"}
          </span>
        </div>

        <div>
          <span className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
            Grade
          </span>
          <span className="font-semibold text-foreground text-sm">{offer.grade || "N/A"}</span>
        </div>

        <div>
          <span className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
            Joining Date
          </span>
          <span className="font-semibold text-foreground text-sm">
            {offer.joiningDate ? format(new Date(offer.joiningDate), "MMM dd, yyyy") : "N/A"}
          </span>
        </div>

        <div>
          <span className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
            Offer Expiry
          </span>
          <span className="font-semibold text-foreground text-sm">
            {offer.expiresAt ? format(new Date(offer.expiresAt), "MMM dd, yyyy") : "N/A"}
          </span>
        </div>

        <div>
          <span className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
            Probation Period
          </span>
          <span className="font-semibold text-foreground text-sm">
            {offer.probationDays ? `${offer.probationDays} Days` : "None"}
          </span>
        </div>

        <div>
          <span className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
            Notice Buyout
          </span>
          <span className="font-semibold text-foreground text-sm">
            {offer.noticeBuyout ? "Eligible" : "Not Eligible"}
          </span>
        </div>
      </div>
    </div>
  );
}
