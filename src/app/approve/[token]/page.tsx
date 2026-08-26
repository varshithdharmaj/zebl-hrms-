import { headers } from "next/headers";
import {
  buildPublicApprovalView,
  recordTokenView,
} from "@/lib/approval-tokens/token-validator";
import { getClientIp, getUserAgent } from "@/lib/request-meta";
import { ApprovalConfirmation } from "@/components/approval/approval-confirmation";
import { RejectionForm } from "@/components/approval/rejection-form";
import { TokenErrorState } from "@/components/approval/token-error-state";

export default async function PublicApprovePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const signedToken = decodeURIComponent(token);
  const hdrs = await headers();

  await recordTokenView(signedToken, {
    clientIp: getClientIp(hdrs),
    userAgent: getUserAgent(hdrs),
  });

  const result = await buildPublicApprovalView(signedToken);

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto mb-8 max-w-lg text-center">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-sm font-bold text-primary-foreground shadow-card">
          Z
        </div>
        <h1 className="text-lg font-semibold text-foreground">Zebl Leave Approval</h1>
        <p className="mt-1 text-sm text-muted-foreground">Secure email approval — no sign-in required</p>
      </div>

      <div className="mx-auto max-w-lg">
        {!result.ok ? (
          <TokenErrorState code={result.code} message={result.message} />
        ) : result.view.action === "reject" ? (
          <RejectionForm view={result.view} signedToken={result.signedToken} />
        ) : (
          <ApprovalConfirmation view={result.view} signedToken={result.signedToken} />
        )}
      </div>
    </div>
  );
}
