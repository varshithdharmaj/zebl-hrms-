"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/error-alert";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard-error]", error.digest ?? error.message);
  }, [error]);

  const isChunkError =
    error.message?.includes("Loading chunk") || error.name === "ChunkLoadError";

  return (
    <div className="mx-auto max-w-lg space-y-4 p-8">
      <ErrorAlert
        message={
          isChunkError
            ? "A new version of the app is available or cached files expired. Please refresh the page."
            : "Something went wrong loading this page. Please try again or sign out and back in."
        }
      />
      {error.digest && (
        <p className="text-xs text-muted-foreground">Reference: {error.digest}</p>
      )}
      <div className="flex gap-2">
        {isChunkError ? (
          <Button onClick={() => window.location.reload()}>Refresh Page</Button>
        ) : (
          <Button onClick={() => reset()}>Try again</Button>
        )}
        <Button variant="outline" asChild>
          <a href="/login">Back to login</a>
        </Button>
      </div>
    </div>
  );
}
