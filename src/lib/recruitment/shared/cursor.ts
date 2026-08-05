import type { CursorPageResult, CursorPaginationInput } from "@/lib/recruitment/types/pagination";
import { MAX_PAGE_SIZE } from "@/lib/recruitment/shared/pagination";

export function normalizeCursorPagination(
  input: Partial<CursorPaginationInput>
): CursorPaginationInput {
  const limitRaw =
    Number.isFinite(input.limit) && (input.limit ?? 0) > 0
      ? Math.floor(input.limit!)
      : 25;
  return {
    cursor: input.cursor ?? null,
    limit: Math.min(MAX_PAGE_SIZE, Math.max(1, limitRaw)),
  };
}

export function encodeCursor(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

export function decodeCursor(cursor: string | null): string | null {
  if (!cursor) return null;
  try {
    return Buffer.from(cursor, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

export function toCursorPageResult<T>(
  items: T[],
  limit: number,
  getCursor: (item: T) => string
): CursorPageResult<T> {
  const hasMore = items.length > limit;
  const pageItems = hasMore ? items.slice(0, limit) : items;
  const last = pageItems[pageItems.length - 1];
  return {
    items: pageItems,
    nextCursor: hasMore && last ? encodeCursor(getCursor(last)) : null,
    hasMore,
  };
}
