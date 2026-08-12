import { DashboardPageSkeleton } from "@/components/loading";

export default function AdminDashboardLoading() {
  return (
    <DashboardPageSkeleton label="Loading command center" kpiCount={4} showTable />
  );
}
