import { ListPageSkeleton } from "@/components/loading";

export default function JobOpeningsLoading() {
  return (
    <ListPageSkeleton
      label="Loading job openings"
      filterFields={3}
      tableRows={5}
      tableColumns={5}
    />
  );
}
