import { ListPageSkeleton } from "@/components/loading";

export function OfferSkeleton() {
  return (
    <ListPageSkeleton
      label="Loading offers"
      filterFields={3}
      tableRows={5}
      tableColumns={5}
      withHeaderAction
    />
  );
}
