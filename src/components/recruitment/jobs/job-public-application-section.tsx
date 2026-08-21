"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  setPublicListingAction,
  type SetPublicListingActionState,
} from "@/actions/recruitment-jobs";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/error-alert";
import { JobOpeningStatus } from "@/generated/prisma/enums";

const initial: SetPublicListingActionState = {};

/** Pure so it's directly unit-testable without rendering the component. */
export function buildPublicApplyUrl(appBaseUrl: string, publicSlug: string | null): string | null {
  if (!publicSlug) return null;
  return `${appBaseUrl.replace(/\/$/, "")}/apply/${publicSlug}`;
}

export function JobPublicApplicationSection({
  jobId,
  jobStatus,
  appBaseUrl,
  isPubliclyListed: initialIsPubliclyListed,
  publicSlug: initialPublicSlug,
}: {
  jobId: string;
  jobStatus: JobOpeningStatus;
  appBaseUrl: string;
  isPubliclyListed: boolean;
  publicSlug: string | null;
}) {
  const [state, action, pending] = useActionState(setPublicListingAction, initial);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  // Server-returned state takes over once the action has run; otherwise fall
  // back to what the page loaded with (avoids a flash of "Off" on mount).
  const isPubliclyListed = state.isPubliclyListed ?? initialIsPubliclyListed;
  const publicSlug = state.publicSlug ?? initialPublicSlug;
  const publicUrl = buildPublicApplyUrl(appBaseUrl, publicSlug);
  const eligible = jobStatus === JobOpeningStatus.open;

  async function handleCopy() {
    if (!publicUrl) return;
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopyError("Couldn't copy automatically — select and copy the link above.");
    }
  }

  return (
    <div className="space-y-3">
      {state.error && <ErrorAlert message={state.error} />}
      {state.success && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {state.success}
        </p>
      )}

      <div className="flex items-center gap-3">
        <span
          className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
            isPubliclyListed
              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20"
              : "bg-muted text-muted-foreground ring-1 ring-border"
          }`}
        >
          {isPubliclyListed ? "On" : "Off"}
        </span>

        <form action={action}>
          <input type="hidden" name="id" value={jobId} />
          <input type="hidden" name="isPubliclyListed" value={isPubliclyListed ? "false" : "true"} />
          <Button
            type="submit"
            variant="outline"
            size="sm"
            loading={pending}
            disabled={!isPubliclyListed && !eligible}
          >
            {isPubliclyListed ? "Stop accepting public applications" : "Accept public applications"}
          </Button>
        </form>
      </div>

      {!isPubliclyListed && !eligible && (
        <p className="text-sm text-muted-foreground">
          Only open jobs can be listed publicly. Open this job first, then publish it.
        </p>
      )}

      {!isPubliclyListed && eligible && (
        <p className="text-sm text-muted-foreground">
          This job is not publicly accepting applications.
        </p>
      )}

      {isPubliclyListed && publicUrl && (
        <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3">
          <p className="text-sm text-muted-foreground">Share this application link:</p>
          <p className="break-all font-mono text-sm text-foreground">{publicUrl}</p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
              Copy link
            </Button>
            <Button type="button" variant="ghost" size="sm" asChild>
              <Link href={`/apply/${publicSlug}`} target="_blank" rel="noopener noreferrer">
                Open public page
              </Link>
            </Button>
            <span aria-live="polite" className="text-sm text-muted-foreground">
              {copied ? "Link copied" : copyError}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
