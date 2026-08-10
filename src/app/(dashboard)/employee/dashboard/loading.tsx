import { DashboardPageSkeleton } from "@/components/loading";

export default function EmployeeDashboardLoading() {
  return (
    <DashboardPageSkeleton label="Loading dashboard" kpiCount={3} showTable={false} />
  );
}
