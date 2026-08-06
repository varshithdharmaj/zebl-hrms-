"use client";

import React, { useState } from "react";
import { OfferStatus } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { OfferListFilterState } from "@/lib/recruitment/offer/list-href";

export function OfferFilters({
  filters,
  jobs,
  recruiters,
}: {
  filters: OfferListFilterState;
  jobs: readonly { id: string; title: string }[];
  recruiters: readonly { id: string; email: string }[];
}) {
  const [status, setStatus] = useState(filters.status ?? "all");
  const [jobOpeningId, setJobOpeningId] = useState(filters.jobOpeningId ?? "all");
  const [recruiterUserId, setRecruiterUserId] = useState(filters.recruiterUserId ?? "all");

  return (
    <form className="grid gap-4 rounded-xl border border-border bg-card p-5 shadow-subtle sm:grid-cols-2 md:grid-cols-5">
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="jobOpeningId" value={jobOpeningId} />
      <input type="hidden" name="recruiterUserId" value={recruiterUserId} />

      <div className="space-y-1.5">
        <label htmlFor="q" className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Search Candidate
        </label>
        <Input
          id="q"
          name="q"
          defaultValue={filters.q ?? ""}
          placeholder="Name or offer #"
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
            <SelectItem value={OfferStatus.draft}>Draft</SelectItem>
            <SelectItem value={OfferStatus.released}>Sent</SelectItem>
            <SelectItem value={OfferStatus.accepted}>Accepted</SelectItem>
            <SelectItem value={OfferStatus.declined}>Declined</SelectItem>
            <SelectItem value={OfferStatus.withdrawn}>Withdrawn</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Job
        </span>
        <Select value={jobOpeningId} onValueChange={setJobOpeningId}>
          <SelectTrigger className="h-10 bg-background" aria-label="Job filter">
            <SelectValue placeholder="All Jobs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Jobs</SelectItem>
            {jobs.map((job) => (
              <SelectItem key={job.id} value={job.id}>
                {job.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Recruiter
        </span>
        <Select value={recruiterUserId} onValueChange={setRecruiterUserId}>
          <SelectTrigger className="h-10 bg-background" aria-label="Recruiter filter">
            <SelectValue placeholder="All Recruiters" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Recruiters</SelectItem>
            {recruiters.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col justify-end">
        <Button type="submit" className="font-semibold shadow-subtle h-10 w-full">
          Apply Filters
        </Button>
      </div>
    </form>
  );
}
