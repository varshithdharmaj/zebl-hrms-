"use client";

import React, { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { attachOfferPdfAction, generateOfferLetterAction } from "@/actions/recruitment-offers";

export function OfferPDFViewer({
  offer,
  canManage = true,
}: {
  offer: { id: string; offerPdfKey?: string | null; letterGeneratedAt?: Date | string | null };
  canManage?: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [isGenerating, startGenerating] = useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const pdfKey = offer.offerPdfKey;
  const isGeneratedLetter = Boolean(offer.letterGeneratedAt);

  const handleGenerate = () => {
    setError(null);
    setSuccess(null);
    startGenerating(async () => {
      const res = await generateOfferLetterAction({}, { id: offer.id });
      if (res.error) {
        setError(res.error);
      } else {
        setSuccess(res.success ?? "Offer letter generated.");
        router.refresh();
      }
    });
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.set("id", offer.id);
    formData.set("file", file);

    startTransition(async () => {
      const res = await attachOfferPdfAction({}, formData);
      if (res.error) {
        setError(res.error);
      } else {
        setSuccess(res.success ?? "PDF attached.");
        router.refresh();
      }
      if (inputRef.current) inputRef.current.value = "";
    });
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-subtle space-y-6">
      <div className="border-b border-border pb-4">
        <h3 className="text-lg font-bold text-foreground">Offer Letter (PDF)</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Generate the offer letter from the ZEBL template, preview it, then download or send it
          to the candidate.
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          {success}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        disabled={isPending || !canManage}
        onChange={handleUpload}
      />

      {pdfKey ? (
        <div className="flex flex-col items-center justify-center border border-border rounded-xl p-8 bg-slate-50/50">
          <div className="font-semibold text-foreground text-sm truncate max-w-full">
            {pdfKey.split("/").pop()}
          </div>
          <p className="text-xs text-muted-foreground mt-1 mb-4 text-center">
            {isGeneratedLetter ? "Generated from template" : "Manually attached"}
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            <Button asChild variant="outline" size="sm" className="font-semibold shadow-subtle">
              <a
                href={`/api/recruitment/offers/pdf?id=${encodeURIComponent(offer.id)}&inline=1`}
                target="_blank"
                rel="noreferrer"
              >
                Preview
              </a>
            </Button>
            <Button asChild variant="outline" size="sm" className="font-semibold shadow-subtle">
              <a href={`/api/recruitment/offers/pdf?id=${encodeURIComponent(offer.id)}`}>
                Download PDF
              </a>
            </Button>
            {canManage ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="font-semibold"
                  disabled={isGenerating}
                  onClick={handleGenerate}
                >
                  {isGenerating ? "Regenerating…" : "Regenerate Letter"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="font-semibold text-muted-foreground"
                  disabled={isPending}
                  onClick={() => inputRef.current?.click()}
                >
                  {isPending ? "Uploading…" : "Upload Manually"}
                </Button>
              </>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center border border-dashed border-border rounded-xl p-8 text-center text-muted-foreground">
          <div className="text-sm font-medium text-foreground">No Offer Letter Generated</div>
          <p className="text-xs mt-1 mb-4">
            Generate the offer letter from the ZEBL template using the offer&rsquo;s current
            details.
          </p>
          {canManage ? (
            <div className="flex flex-wrap gap-2 justify-center">
              <Button
                type="button"
                size="sm"
                className="font-semibold shadow-subtle"
                disabled={isGenerating}
                onClick={handleGenerate}
              >
                {isGenerating ? "Generating…" : "Generate Offer Letter"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="font-semibold text-muted-foreground"
                disabled={isPending}
                onClick={() => inputRef.current?.click()}
              >
                {isPending ? "Uploading…" : "Upload Manually Instead"}
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
