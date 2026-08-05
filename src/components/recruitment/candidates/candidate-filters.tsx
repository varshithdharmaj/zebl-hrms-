"use client";

import React, { useState } from "react";
import Link from "next/link";
import { CandidateStatus, CandidateSource } from "@/generated/prisma/enums";
import { CANDIDATE_STATUS_LABELS, CANDIDATE_SOURCE_LABELS } from "@/lib/recruitment/candidate/labels";
import type { CandidateListFilterState } from "@/lib/recruitment/candidate/list-href";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

export type { CandidateListFilterState };
export { candidateListHref } from "@/lib/recruitment/candidate/list-href";

export function CandidateFilters({ filters }: { filters: CandidateListFilterState }) {
  const [status, setStatus] = useState(filters.status ?? "all");
  const [source, setSource] = useState(filters.source ?? "all");
  const [sort, setSort] = useState(filters.sort ?? "createdAt");
  const [includeArchived, setIncludeArchived] = useState(filters.includeArchived ?? false);

  return (
    <form className="grid gap-4 rounded-xl border border-border bg-card p-5 shadow-subtle sm:grid-cols-2 md:grid-cols-6">
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="source" value={source} />
      <input type="hidden" name="sort" value={sort} />
      <input type="hidden" name="includeArchived" value={includeArchived ? "true" : "false"} />
      <input type="hidden" name="direction" value={filters.direction ?? "desc"} />

      <div className="md:col-span-2 space-y-1.5">
        <label htmlFor="q" className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Search
        </label>
        <Input
          id="q"
          name="q"
          defaultValue={filters.q ?? ""}
          placeholder="Name, email, phone, company, title…"
          className="h-10"
        />
      </div>

      <div className="space-y-1.5">
        <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Status
        </span>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-10 bg-background" aria-label="Status filter">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.values(CandidateStatus).map((s) => (
              <SelectItem key={s} value={s}>
                {CANDIDATE_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Source
        </span>
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger className="h-10 bg-background" aria-label="Source filter">
            <SelectValue placeholder="All Sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            {Object.values(CandidateSource).map((s) => (
              <SelectItem key={s} value={s}>
                {CANDIDATE_SOURCE_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Sort By
        </span>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="h-10 bg-background" aria-label="Sort by">
            <SelectValue placeholder="Date Created" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="createdAt">Date Created</SelectItem>
            <SelectItem value="fullName">Full Name</SelectItem>
            <SelectItem value="status">Status</SelectItem>
            <SelectItem value="updatedAt">Date Updated</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col justify-end gap-3">
        <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground cursor-pointer select-none">
          <Checkbox
            checked={includeArchived}
            onCheckedChange={(checked) => setIncludeArchived(!!checked)}
          />
          Include archived
        </label>
        <Button type="submit" variant="secondary" className="h-10 font-medium shadow-subtle">
          Apply filters
        </Button>
      </div>

      {(filters.q || (filters.status && filters.status !== "all") || (filters.source && filters.source !== "all") || filters.includeArchived) && (
        <div className="md:col-span-6 pt-1">
          <Link href="/admin/recruitment/candidates" className="text-xs font-medium text-primary hover:underline">
            Clear all filters
          </Link>
        </div>
      )}
    </form>
  );
}
