import type { RecruitmentScope } from "@/lib/recruitment/types/scope";
import type {
  CursorPaginationInput,
  PageResult,
  PaginationInput,
  SearchFilters,
  SortOptions,
} from "@/lib/recruitment/types/pagination";
import type { DbClient } from "@/lib/recruitment/shared/transaction";

export type RepositoryTx = DbClient;

export type ScopedListArgs = {
  scope: RecruitmentScope;
  filters?: SearchFilters;
  pagination: PaginationInput;
  sort?: SortOptions;
};

export type ScopedSearchArgs = {
  scope: RecruitmentScope;
  query: string;
  pagination: PaginationInput | CursorPaginationInput;
};

export type { PageResult, PaginationInput, SearchFilters, SortOptions, CursorPaginationInput };
