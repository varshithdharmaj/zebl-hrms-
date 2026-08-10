"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { refreshPayrollSummariesAction } from "@/actions/payroll";
import { Button } from "@/components/ui/button";

export function PayrollRefreshButton({ periodKey }: { periodKey: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      loading={isPending}
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          await refreshPayrollSummariesAction(periodKey);
          router.refresh();
        });
      }}
    >
      {!isPending && <RefreshCw className="h-4 w-4" />}
      {isPending ? "Recomputing…" : "Refresh summaries"}
    </Button>
  );
}
