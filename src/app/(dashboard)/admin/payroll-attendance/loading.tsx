import { ListPageSkeleton } from "@/components/loading";

export default function PayrollAttendanceLoading() {
  return (
    <ListPageSkeleton
      label="Loading payroll attendance"
      showKpis
      kpiCount={4}
      filterFields={4}
      tableRows={8}
      tableColumns={7}
    />
  );
}
