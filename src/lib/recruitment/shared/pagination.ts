import type { PageResult, PaginationInput } from "@/lib/recruitment/types/pagination";

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 50;
/** Pipeline board grows by this size per "Load more". */
export const PIPELINE_BOARD_PAGE_SIZE = 50;
export const PIPELINE_BOARD_MAX_ITEMS = 200;

export function normalizePagination(
  input: Partial<PaginationInput>,
  options?: { maxPageSize?: number }
): PaginationInput {
  const max = options?.maxPageSize ?? MAX_PAGE_SIZE;
  const page = Number.isFinite(input.page) && (input.page ?? 0) > 0 ? Math.floor(input.page!) : 1;
  const rawSize =
    Number.isFinite(input.pageSize) && (input.pageSize ?? 0) > 0
      ? Math.floor(input.pageSize!)
      : DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(max, Math.max(1, rawSize));
  return { page, pageSize };
}

/** Growing take for pipeline board: page 1 → 50, page 2 → 100, capped at 200. */
export function normalizePipelineBoardTake(page: number): {
  page: number;
  pageSize: number;
  take: number;
  hasMoreCapacity: boolean;
} {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const take = Math.min(PIPELINE_BOARD_PAGE_SIZE * safePage, PIPELINE_BOARD_MAX_ITEMS);
  return {
    page: safePage,
    pageSize: take,
    take,
    hasMoreCapacity: take < PIPELINE_BOARD_MAX_ITEMS,
  };
}

export function paginationSkip(input: PaginationInput): number {
  return (input.page - 1) * input.pageSize;
}

export function toPageResult<T>(
  items: T[],
  total: number,
  input: PaginationInput
): PageResult<T> {
  const totalPages = total === 0 ? 0 : Math.ceil(total / input.pageSize);
  return {
    items,
    total,
    page: input.page,
    pageSize: input.pageSize,
    totalPages,
  };
}
