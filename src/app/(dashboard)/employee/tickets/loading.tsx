import { ListPageSkeleton } from "@/components/loading";

export default function EmployeeTicketsLoading() {
  return (
    <ListPageSkeleton
      label="Loading tickets"
      filterFields={3}
      tableRows={6}
      tableColumns={5}
    />
  );
}
