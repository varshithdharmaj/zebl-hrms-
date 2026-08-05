"use client";

import React from "react";

export function OfferSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-12 w-full animate-pulse rounded-lg bg-muted" />
      <div className="rounded-xl border border-border bg-card p-4 shadow-subtle">
        <div className="space-y-3">
          <div className="h-8 w-1/3 animate-pulse rounded bg-muted" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
          <div className="h-24 w-full animate-pulse rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}
