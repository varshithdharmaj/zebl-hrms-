import Link from "next/link";
import { JobOpeningStatus } from "@/generated/prisma/enums";
import { JOB_STATUS_LABELS } from "@/lib/recruitment/job/labels";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type JobListFilterState = {
  q?: string;
  status?: string;
  department?: string;
  includeArchived?: boolean;
  sort?: string;
  direction?: string;
  page?: number;
};

export function JobOpeningsFilters({ filters }: { filters: JobListFilterState }) {
  return (
    <form className="grid gap-3 rounded-xl border border-border bg-card p-4 shadow-subtle md:grid-cols-7">
      <div className="md:col-span-2">
        <label htmlFor="q" className="mb-1 block text-xs font-semibold text-muted-foreground">
          Search
        </label>
        <Input
          id="q"
          name="q"
          defaultValue={filters.q ?? ""}
          placeholder="Title, code, department…"
        />
      </div>
      <div>
        <label htmlFor="status" className="mb-1 block text-xs font-semibold text-muted-foreground">
          Status
        </label>
        <select
          id="status"
          name="status"
          defaultValue={filters.status ?? "all"}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="all">All</option>
          {Object.values(JobOpeningStatus).map((s) => (
            <option key={s} value={s}>
              {JOB_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label
          htmlFor="department"
          className="mb-1 block text-xs font-semibold text-muted-foreground"
        >
          Department
        </label>
        <Input
          id="department"
          name="department"
          defaultValue={filters.department ?? ""}
          placeholder="Department"
        />
      </div>
      <div>
        <label htmlFor="sort" className="mb-1 block text-xs font-semibold text-muted-foreground">
          Sort
        </label>
        <select
          id="sort"
          name="sort"
          defaultValue={filters.sort ?? "createdAt"}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="createdAt">Age (created)</option>
          <option value="title">Title</option>
          <option value="status">Status</option>
          <option value="updatedAt">Updated</option>
          <option value="closedAt">Closed</option>
        </select>
      </div>
      <div>
        <label htmlFor="direction" className="mb-1 block text-xs font-semibold text-muted-foreground">
          Order
        </label>
        <select
          id="direction"
          name="direction"
          defaultValue={filters.direction ?? "desc"}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="desc">Newest first</option>
          <option value="asc">Oldest first</option>
        </select>
      </div>
      <div className="flex flex-col justify-end gap-2">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            name="includeArchived"
            value="true"
            defaultChecked={filters.includeArchived}
            className="h-4 w-4 rounded border-border"
          />
          Include archived
        </label>
        <Button type="submit" variant="secondary">
          Apply filters
        </Button>
      </div>
      {(filters.q || filters.status && filters.status !== "all" || filters.department) && (
        <div className="md:col-span-7">
          <Link href="/admin/recruitment/jobs" className="text-sm text-muted-foreground hover:underline">
            Clear filters
          </Link>
        </div>
      )}
    </form>
  );
}

export function jobListHref(filters: JobListFilterState, page?: number): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  if (filters.department) params.set("department", filters.department);
  if (filters.includeArchived) params.set("includeArchived", "true");
  if (filters.sort) params.set("sort", filters.sort);
  if (filters.direction) params.set("direction", filters.direction);
  const p = page ?? filters.page ?? 1;
  if (p > 1) params.set("page", String(p));
  const qs = params.toString();
  return qs ? `/admin/recruitment/jobs?${qs}` : "/admin/recruitment/jobs";
}
