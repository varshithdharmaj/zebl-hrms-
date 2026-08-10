import { ListPageSkeleton } from "@/components/loading";

export default function EmployeeAttendanceLoading() {
  return (
    <ListPageSkeleton
      label="Loading attendance"
      showKpis
      kpiCount={3}
      filterFields={3}
      tableRows={8}
      tableColumns={5}
      withHeaderAction={false}
    />
  );
}
