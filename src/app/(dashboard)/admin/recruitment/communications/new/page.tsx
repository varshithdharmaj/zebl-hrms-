import { Suspense } from "react";
import { requireRecruitmentAdminSession } from "@/lib/auth-guards";
import { ComposeWorkspace } from "@/components/recruitment/communications/compose/compose-workspace";
import { CommunicationLoadingSkeleton } from "@/components/recruitment/communications/communication-loading-skeleton";
import { loadComposePageData } from "@/components/recruitment/communications/compose/load-compose-page-data";
import type { ComposePrefill } from "@/components/recruitment/communications/compose/compose-types";

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

async function NewComposeLoader({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireRecruitmentAdminSession();
  const params = await searchParams;
  const modeRaw = firstParam(params.mode);
  const mode =
    modeRaw === "reply" || modeRaw === "forward" || modeRaw === "compose"
      ? modeRaw
      : "compose";

  const prefill: ComposePrefill = {
    mode,
    candidateId: firstParam(params.candidateId),
    recipientEmail: firstParam(params.recipientEmail),
    applicationId: firstParam(params.applicationId),
    jobOpeningId: firstParam(params.jobOpeningId),
    interviewId: firstParam(params.interviewId),
    offerId: firstParam(params.offerId),
    parentId: firstParam(params.parentId),
    threadId: firstParam(params.threadId),
    systemTemplateId: firstParam(params.templateId),
  };

  const data = await loadComposePageData(session, undefined, prefill);
  return <ComposeWorkspace data={data} />;
}

export default function NewCommunicationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <div className="space-y-6 lg:space-y-8">
      <Suspense fallback={<CommunicationLoadingSkeleton />}>
        <NewComposeLoader searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
