import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";
import { getLatestExecutiveSnapshot } from "@/lib/analytics/analytics-engine";

export default async function AdminAnalyticsPage() {
  const snapshot = await getLatestExecutiveSnapshot();

  return (
    <div className="space-y-8">
      <WorkspacePageHeader
        title="Workforce intelligence"
        description="Operational analytics, anomalies, and executive insights — computed offline from AMS data"
      />
      <AnalyticsDashboard snapshot={snapshot} />
    </div>
  );
}
