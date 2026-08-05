import type { PageResult, PaginationInput } from "@/lib/recruitment/types/pagination";

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 50;

export function normalizePagination(input: Partial<PaginationInput>): PaginationInput {
  const page = Number.isFinite(input.page) && (input.page ?? 0) > 0 ? Math.floor(input.page!) : 1;
  const rawSize =
    Number.isFinite(input.pageSize) && (input.pageSize ?? 0) > 0
      ? Math.floor(input.pageSize!)
      : DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, rawSize));
  return { page, pageSize };
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
