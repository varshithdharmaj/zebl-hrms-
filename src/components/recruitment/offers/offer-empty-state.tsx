"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function OfferEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-12 text-center shadow-subtle">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="h-6 w-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-foreground">No Offers Found</h3>
      <p className="text-sm text-muted-foreground mt-1 mb-6 max-w-sm">
        There are no offers matching the selected criteria. Create a new offer to get started.
      </p>
      <Link href="/admin/recruitment/offers/new">
        <Button className="font-semibold shadow-subtle">Create Offer</Button>
      </Link>
    </div>
  );
}
