import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";
import { getLatestExecutiveSnapshot } from "@/lib/analytics/analytics-engine";

export default async function AdminAnalyticsPage() {
  let snapshot = null;
  try {
    snapshot = await getLatestExecutiveSnapshot();
  } catch (err) {
    console.error("[analytics-page] Failed to load executive snapshot:", err);
  }

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
