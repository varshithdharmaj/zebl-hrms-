import { ListPageSkeleton } from "@/components/loading";

export default function ApplicationsLoading() {
  return (
    <ListPageSkeleton
      label="Loading applications"
      filterFields={4}
      tableRows={7}
      tableColumns={6}
    />
  );
}
