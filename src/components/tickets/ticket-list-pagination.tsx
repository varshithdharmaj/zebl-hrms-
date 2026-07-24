import Link from "next/link";
import {
  ticketListHref,
  ticketListSearchParamsFromFilters,
  type TicketListFilterState,
} from "@/lib/tickets/filter-params";

type TicketListPaginationProps = {
  basePath: string;
  filters: TicketListFilterState;
  pagination: {
    page: number;
    totalPages: number;
  };
};

/** URL-driven pagination for ticket list pages. */
export function TicketListPagination({
  basePath,
  filters,
  pagination,
}: TicketListPaginationProps) {
  if (pagination.totalPages <= 1) return null;

  return (
    <div className="flex justify-center gap-2">
      {pagination.page > 1 && (
        <Link
          href={ticketListHref(
            basePath,
            ticketListSearchParamsFromFilters(filters, { page: pagination.page - 1 })
          )}
          className="rounded-md border bg-background px-4 py-2 text-sm hover:bg-muted"
        >
          Previous
        </Link>
      )}
      <span className="px-4 py-2 text-sm">
        Page {pagination.page} of {pagination.totalPages}
      </span>
      {pagination.page < pagination.totalPages && (
        <Link
          href={ticketListHref(
            basePath,
            ticketListSearchParamsFromFilters(filters, { page: pagination.page + 1 })
          )}
          className="rounded-md border bg-background px-4 py-2 text-sm hover:bg-muted"
        >
          Next
        </Link>
      )}
    </div>
  );
}
