"use client";

import React, { useState } from "react";
import { OfferStatus } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type OfferListFilterState = {
  q?: string;
  status?: string;
  department?: string;
  jobOpeningId?: string;
};

export function OfferFilters({
  filters,
  departments,
  jobs,
}: {
  filters: OfferListFilterState;
  departments: readonly string[];
  jobs: readonly { id: string; title: string }[];
}) {
  const [status, setStatus] = useState(filters.status ?? "all");
  const [department, setDepartment] = useState(filters.department ?? "all");
  const [jobOpeningId, setJobOpeningId] = useState(filters.jobOpeningId ?? "all");

  return (
    <form className="grid gap-4 rounded-xl border border-border bg-card p-5 shadow-subtle sm:grid-cols-2 md:grid-cols-5">
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="department" value={department} />
      <input type="hidden" name="jobOpeningId" value={jobOpeningId} />

      <div className="space-y-1.5">
        <label htmlFor="q" className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Search
        </label>
        <Input
          id="q"
          name="q"
          defaultValue={filters.q ?? ""}
          placeholder="Offer #, Candidate..."
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
            <SelectItem value={OfferStatus.manager_approval}>Manager Approval</SelectItem>
            <SelectItem value={OfferStatus.hr_approval}>HR Approval</SelectItem>
            <SelectItem value={OfferStatus.released}>Sent</SelectItem>
            <SelectItem value={OfferStatus.accepted}>Accepted</SelectItem>
            <SelectItem value={OfferStatus.declined}>Declined</SelectItem>
            <SelectItem value={OfferStatus.withdrawn}>Withdrawn</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Department
        </span>
        <Select value={department} onValueChange={setDepartment}>
          <SelectTrigger className="h-10 bg-background" aria-label="Department filter">
            <SelectValue placeholder="All Departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {departments.map((dept) => (
              <SelectItem key={dept} value={dept}>
                {dept}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Job Opening
        </span>
        <Select value={jobOpeningId} onValueChange={setJobOpeningId}>
          <SelectTrigger className="h-10 bg-background" aria-label="Job Opening filter">
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

      <div className="flex flex-col justify-end">
        <Button type="submit" className="font-semibold shadow-subtle h-10 w-full">
          Apply Filters
        </Button>
      </div>
    </form>
  );
}
