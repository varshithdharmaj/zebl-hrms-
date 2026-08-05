"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ApplicationStatus, RecruitmentPipelineStage } from "@/generated/prisma/enums";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { LayoutGrid, List } from "lucide-react";

export type ApplicationListFilterState = {
  q?: string;
  status?: string;
  currentStage?: string;
  jobOpeningId?: string;
  view?: "board" | "list";
  sort?: string;
  direction?: string;
  page?: number;
};

export function applicationListHref(
  filters: ApplicationListFilterState,
  page?: number,
  basePath = "/admin/recruitment/pipeline"
) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  if (filters.currentStage && filters.currentStage !== "all") params.set("currentStage", filters.currentStage);
  if (filters.jobOpeningId && filters.jobOpeningId !== "all") params.set("jobOpeningId", filters.jobOpeningId);
  if (filters.view) params.set("view", filters.view);
  if (filters.sort) params.set("sort", filters.sort);
  if (filters.direction) params.set("direction", filters.direction);
  if (page) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function ApplicationFilters({
  filters,
  jobs,
  basePath = "/admin/recruitment/pipeline",
}: {
  filters: ApplicationListFilterState;
  jobs: { id: string; title: string }[];
  basePath?: string;
}) {
  const [status, setStatus] = useState(filters.status ?? "all");
  const [currentStage, setCurrentStage] = useState(filters.currentStage ?? "all");
  const [jobOpeningId, setJobOpeningId] = useState(filters.jobOpeningId ?? "all");
  const [view, setView] = useState<"board" | "list">(filters.view ?? "board");

  return (
    <form
      action={basePath}
      className="grid gap-4 rounded-xl border border-border bg-card p-5 shadow-subtle sm:grid-cols-2 md:grid-cols-6"
    >
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="currentStage" value={currentStage} />
      <input type="hidden" name="jobOpeningId" value={jobOpeningId} />
      <input type="hidden" name="view" value={view} />
      <input type="hidden" name="sort" value={filters.sort ?? "createdAt"} />
      <input type="hidden" name="direction" value={filters.direction ?? "desc"} />

      <div className="md:col-span-2 space-y-1.5">
        <label htmlFor="q" className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Search
        </label>
        <Input
          id="q"
          name="q"
          defaultValue={filters.q ?? ""}
          placeholder="Candidate name, email, job title…"
          className="h-10"
        />
      </div>

      <div className="space-y-1.5">
        <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Job Opening
        </span>
        <Select value={jobOpeningId} onValueChange={setJobOpeningId}>
          <SelectTrigger className="h-10 bg-background" aria-label="Job filter">
            <SelectValue placeholder="All Jobs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Jobs</SelectItem>
            {jobs.map((j) => (
              <SelectItem key={j.id} value={j.id}>
                {j.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
            {Object.values(ApplicationStatus).map((s) => (
              <SelectItem key={s} value={s}>
                {s.replace("_", " ").toUpperCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Pipeline Stage
        </span>
        <Select value={currentStage} onValueChange={setCurrentStage}>
          <SelectTrigger className="h-10 bg-background" aria-label="Stage filter">
            <SelectValue placeholder="All Stages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            {Object.values(RecruitmentPipelineStage).map((s) => (
              <SelectItem key={s} value={s}>
                {s.replace("_", " ").toUpperCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col justify-end gap-2">
        <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground md:hidden">
          View Mode
        </span>
        <div className="flex gap-1.5 h-10 items-center justify-between">
          <div className="flex bg-muted p-1 rounded-lg border border-border/40">
            <Button
              type="button"
              variant={view === "board" ? "default" : "ghost"}
              size="icon"
              onClick={() => setView("board")}
              className="h-8 w-8 rounded-md"
              title="Board View"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={view === "list" ? "default" : "ghost"}
              size="icon"
              onClick={() => setView("list")}
              className="h-8 w-8 rounded-md"
              title="List View"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          <Button type="submit" className="font-semibold shadow-subtle h-8 px-4">
            Filter
          </Button>
        </div>
      </div>
    </form>
  );
}
