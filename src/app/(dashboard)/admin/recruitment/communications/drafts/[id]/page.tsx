import { Suspense } from "react";
import { requireRecruitmentAdminSession } from "@/lib/auth-guards";
import { ComposeWorkspace } from "@/components/recruitment/communications/compose/compose-workspace";
import { CommunicationLoadingSkeleton } from "@/components/recruitment/communications/communication-loading-skeleton";
import { loadComposePageData } from "@/components/recruitment/communications/compose/load-compose-page-data";

async function EditDraftLoader({ id }: { id: string }) {
  const session = await requireRecruitmentAdminSession();
  const data = await loadComposePageData(session, id);
  return <ComposeWorkspace data={data} />;
}

export default async function EditCommunicationDraftPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="space-y-6 lg:space-y-8">
      <Suspense fallback={<CommunicationLoadingSkeleton />}>
        <EditDraftLoader id={id} />
      </Suspense>
    </div>
  );
}
