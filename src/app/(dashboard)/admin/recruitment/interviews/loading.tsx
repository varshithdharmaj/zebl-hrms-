import { ListPageSkeleton } from "@/components/loading";

export default function InterviewsLoading() {
  return (
    <ListPageSkeleton
      label="Loading interviews"
      filterFields={3}
      tableRows={6}
      tableColumns={5}
    />
  );
}
