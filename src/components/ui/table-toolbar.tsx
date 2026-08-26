import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function TableToolbar({
  searchName = "q",
  searchPlaceholder = "Search…",
  initialSearch = "",
  statusName = "status",
  initialStatus = "",
  statusOptions,
  clearHref,
}: {
  searchName?: string;
  searchPlaceholder?: string;
  initialSearch?: string;
  statusName?: string;
  initialStatus?: string;
  statusOptions?: { value: string; label: string }[];
  clearHref: string;
}) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-3">
      <div className="min-w-[200px] flex-1">
        <Input
          name={searchName}
          placeholder={searchPlaceholder}
          defaultValue={initialSearch}
          aria-label="Search"
        />
      </div>
      {statusOptions && (
        <select
          name={statusName}
          defaultValue={initialStatus}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {statusOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
      <Button type="submit" variant="outline" size="sm">
        Apply
      </Button>
      <Link href={clearHref} className="text-sm text-muted-foreground hover:underline">
        Clear
      </Link>
    </form>
  );
}
