import { DashboardPageSkeleton } from "@/components/loading";

export default function EmployeeLoading() {
  return (
    <DashboardPageSkeleton label="Loading employee workspace" kpiCount={3} showTable={false} />
  );
}
