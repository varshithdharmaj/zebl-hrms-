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

  return (
    <div className="mx-auto max-w-lg space-y-4 p-8">
      <ErrorAlert message="Something went wrong loading this page. Please try again or sign out and back in." />
      {error.digest && (
        <p className="text-xs text-muted-foreground">Reference: {error.digest}</p>
      )}
      <div className="flex gap-2">
        <Button onClick={() => reset()}>Try again</Button>
        <Button variant="outline" asChild>
          <a href="/login">Back to login</a>
        </Button>
      </div>
    </div>
  );
}
