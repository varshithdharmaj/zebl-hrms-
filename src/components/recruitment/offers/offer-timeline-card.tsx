"use client";

import React from "react";
import { format } from "date-fns";
import type { TimelineItem } from "@/lib/recruitment/types/timeline";

/** Fields this card reads; `actorUser` is optional enrichment beyond `TimelineItem`. */
export type OfferTimelineCardItem = Pick<TimelineItem, "id" | "summary"> & {
  createdAt: string | Date;
  actorUser?: { email: string } | null;
};

export function OfferTimelineCard({
  timeline = [],
}: {
  timeline?: readonly OfferTimelineCardItem[];
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-subtle space-y-6">
      <div className="border-b border-border pb-4">
        <h3 className="text-lg font-bold text-foreground">Offer Activity & Timeline</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Historical events and state transitions for this offer.
        </p>
      </div>

      {timeline.length === 0 ? (
        <div className="text-sm text-muted-foreground py-4 text-center">
          No timeline events recorded yet.
        </div>
      ) : (
        <div className="relative border-l border-border pl-6 ml-3 space-y-6">
          {timeline.map((item) => (
            <div key={item.id} className="relative">
              {/* Timeline Dot */}
              <span className="absolute -left-[31px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-primary bg-background">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              </span>

              <div>
                <p className="text-sm font-semibold text-foreground">{item.summary}</p>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(item.createdAt), "MMM dd, yyyy 'at' hh:mm a")}
                  </span>
                  {item.actorUser && (
                    <>
                      <span className="text-muted-foreground text-xs">•</span>
                      <span className="text-xs font-medium text-foreground">
                        {item.actorUser.email}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
