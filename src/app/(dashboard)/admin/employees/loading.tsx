import { ListPageSkeleton } from "@/components/loading";

export default function EmployeesLoading() {
  return (
    <ListPageSkeleton
      label="Loading employees"
      filterFields={2}
      tableRows={8}
      tableColumns={6}
    />
  );
}
