import { ListPageSkeleton } from "@/components/loading";

export default function ConversionsLoading() {
  return (
    <ListPageSkeleton
      label="Loading conversions"
      filterFields={3}
      tableRows={6}
      tableColumns={5}
    />
  );
}
