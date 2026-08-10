import { ListPageSkeleton } from "@/components/loading";

export default function TicketsLoading() {
  return (
    <ListPageSkeleton
      label="Loading helpdesk tickets"
      showKpis
      kpiCount={4}
      filterFields={4}
      tableRows={8}
      tableColumns={6}
    />
  );
}
