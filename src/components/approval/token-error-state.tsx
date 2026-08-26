import type { TokenErrorCode } from "@/lib/approval-tokens/token-types";

const titles: Record<TokenErrorCode, string> = {
  invalid_format: "Invalid link",
  invalid_signature: "Invalid link",
  not_found: "Link not found",
  expired: "Link expired",
  consumed: "Already processed",
  revoked: "Link no longer valid",
  action_mismatch: "Invalid action",
  step_inactive: "Step no longer active",
  workflow_closed: "Request closed",
  rate_limited: "Too many requests",
};

export function TokenErrorState({
  code,
  message,
}: {
  code: TokenErrorCode;
  message: string;
}) {
  return (
    <div className="mx-auto w-full max-w-lg rounded-2xl border border-border bg-card p-8 shadow-card">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
        !
      </div>
      <h1 className="text-xl font-semibold text-foreground">{titles[code] ?? "Unable to proceed"}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      <p className="mt-6 text-xs text-muted-foreground">
        Sign in to Zebl AMS if you need to review this request in the approval inbox.
      </p>
    </div>
  );
}
