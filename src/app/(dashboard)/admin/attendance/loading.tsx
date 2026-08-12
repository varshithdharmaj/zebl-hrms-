import { ListPageSkeleton } from "@/components/loading";

export default function AdminAttendanceLoading() {
  return (
    <ListPageSkeleton
      label="Loading attendance"
      filterFields={4}
      tableRows={10}
      tableColumns={7}
    />
  );
}
