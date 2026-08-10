import { ListPageSkeleton } from "@/components/loading";

export default function EmployeeLeavesLoading() {
  return (
    <ListPageSkeleton
      label="Loading leave"
      showKpis
      kpiCount={3}
      filterFields={2}
      tableRows={6}
      tableColumns={5}
      withHeaderAction={false}
    />
  );
}
