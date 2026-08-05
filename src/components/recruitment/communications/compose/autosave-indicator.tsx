import { Check, Loader2, AlertCircle } from "lucide-react";
import type { AutosaveStatus } from "./compose-types";

export function AutosaveIndicator({ status }: { status: AutosaveStatus }) {
  if (status === "idle") {
    return (
      <span className="text-xs text-slate-400" aria-live="polite">
        All changes saved locally
      </span>
    );
  }

  if (status === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-slate-500" aria-live="polite">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        Saving draft…
      </span>
    );
  }

  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-red-600" aria-live="assertive">
        <AlertCircle className="h-3.5 w-3.5" aria-hidden />
        Autosave failed
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600" aria-live="polite">
      <Check className="h-3.5 w-3.5" aria-hidden />
      Draft saved
    </span>
  );
}
