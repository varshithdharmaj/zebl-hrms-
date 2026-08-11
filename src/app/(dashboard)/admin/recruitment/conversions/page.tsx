import Link from "next/link";
import { requireRecruitmentAdminSession } from "@/lib/auth-guards";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { ConversionTabsView } from "@/components/recruitment/conversions/conversion-tabs-view";
import {
  listPendingConversionsCached,
  listConversionHistoryCached,
} from "@/lib/recruitment/conversion/queries";
import { Button } from "@/components/ui/button";

export default async function PendingConversionsPage() {
  const session = await requireRecruitmentAdminSession();

  const [pendingConversions, history] = await Promise.all([
    listPendingConversionsCached(session),
    listConversionHistoryCached(session),
  ]);

  return (
    <div className="space-y-6 lg:space-y-8">
      <WorkspacePageHeader
        title="Pending Conversions"
        description="Accepted offers waiting to become employees. Conversion is the only hiring path."
        action={
          <Button asChild variant="outline" size="sm" className="font-semibold text-xs">
            <Link href="/admin/recruitment/offers?status=accepted">View Accepted Offers</Link>
          </Button>
        }
      />

      <ConversionTabsView
        pendingConversions={pendingConversions}
        history={history}
      />
    </div>
  );
}
