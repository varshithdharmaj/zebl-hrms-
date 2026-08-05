import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AutosaveIndicator } from "./autosave-indicator";
import type { AutosaveStatus } from "./compose-types";

export function ComposeHeader({
  title,
  autosaveStatus,
  onBack,
}: {
  title: string;
  autosaveStatus: AutosaveStatus;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-2"
          onClick={onBack}
          aria-label="Leave compose workspace"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back
        </Button>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
          <p className="text-xs text-slate-500">
            Compose recruitment email ·{" "}
            <Link
              href="/admin/recruitment/communications"
              className="underline-offset-2 hover:underline"
            >
              Communication Center
            </Link>
          </p>
        </div>
      </div>
      <AutosaveIndicator status={autosaveStatus} />
    </div>
  );
}
