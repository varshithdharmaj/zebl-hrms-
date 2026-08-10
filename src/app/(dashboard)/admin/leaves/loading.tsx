import { ListPageSkeleton } from "@/components/loading";

export default function LeavesLoading() {
  return (
    <ListPageSkeleton
      label="Loading leave management"
      showKpis
      kpiCount={3}
      filterFields={3}
      tableRows={7}
      tableColumns={6}
    />
  );
}
