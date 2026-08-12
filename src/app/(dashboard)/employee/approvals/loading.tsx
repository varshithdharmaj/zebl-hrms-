import { ListPageSkeleton } from "@/components/loading";

export default function ApprovalsLoading() {
  return (
    <ListPageSkeleton
      label="Loading approvals"
      filterFields={2}
      tableRows={6}
      tableColumns={5}
    />
  );
}
