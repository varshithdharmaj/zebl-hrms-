export type SortDirection = "asc" | "desc";

export type SortOptions = {
  field: string;
  direction: SortDirection;
};

export type PaginationInput = {
  page: number;
  pageSize: number;
};

export type CursorPaginationInput = {
  cursor: string | null;
  limit: number;
};

export type PageResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type CursorPageResult<T> = {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type SearchFilters = {
  q?: string;
  status?: string;
  [key: string]: string | number | boolean | undefined;
};
