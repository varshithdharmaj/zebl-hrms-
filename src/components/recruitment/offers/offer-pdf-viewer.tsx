"use client";

import React from "react";
import { Button } from "@/components/ui/button";

export function OfferPDFViewer({ offer }: { offer: any }) {
  const pdfKey = offer.offerPdfKey;

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-subtle space-y-6">
      <div className="border-b border-border pb-4">
        <h3 className="text-lg font-bold text-foreground">Offer Document (PDF)</h3>
        <p className="text-sm text-muted-foreground mt-1">
          The official offer letter document generated for the candidate.
        </p>
      </div>

      {pdfKey ? (
        <div className="flex flex-col items-center justify-center border border-border rounded-xl p-8 bg-slate-50/50">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="h-12 w-12 text-red-500 mb-3"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
            />
          </svg>
          <div className="font-semibold text-foreground text-sm">{pdfKey.split("/").pop()}</div>
          <p className="text-xs text-muted-foreground mt-1 mb-4">
            Path: {pdfKey}
          </p>
          <Button variant="outline" size="sm" className="font-semibold shadow-subtle">
            Download PDF
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center border border-dashed border-border rounded-xl p-8 text-center text-muted-foreground">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="h-10 w-10 mb-2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div className="text-sm font-medium">No PDF Attached</div>
          <p className="text-xs mt-1">
            You can upload or link an offer letter PDF in the edit form.
          </p>
        </div>
      )}
    </div>
  );
}
