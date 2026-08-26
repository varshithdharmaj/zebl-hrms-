"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApplicationStatus, RecruitmentPipelineStage } from "@/generated/prisma/enums";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { LayoutGrid, List, UserRound, AlertTriangle } from "lucide-react";

export type ApplicationListFilterState = {
  q?: string;
  status?: string;
  currentStage?: string;
  jobOpeningId?: string;
  view?: "board" | "list";
  sort?: string;
  direction?: string;
  page?: number;
  pageSize?: number;
  mine?: boolean;
  needsAttention?: boolean;
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
  if (filters.pageSize) params.set("pageSize", String(filters.pageSize));
  if (filters.mine) params.set("mine", "1");
  if (filters.needsAttention) params.set("needsAttention", "1");
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
  const router = useRouter();
  const [q, setQ] = useState(filters.q ?? "");
  const [status, setStatus] = useState(filters.status ?? "all");
  const [currentStage, setCurrentStage] = useState(filters.currentStage ?? "all");
  const [jobOpeningId, setJobOpeningId] = useState(filters.jobOpeningId ?? "all");
  const [view, setView] = useState<"board" | "list">(filters.view ?? "board");
  const [mine, setMine] = useState(filters.mine ?? false);
  const [needsAttention, setNeedsAttention] = useState(filters.needsAttention ?? false);

  /**
   * Every control here navigates immediately — Select/Button onChange
   * handlers previously only updated local state + a hidden <input>, so
   * nothing happened until a separate "Filter" submit click. Board/List,
   * My Candidates, Needs Attention, and the Job dropdown (which gates
   * dynamic-stage-board rendering) all need to take effect on click.
   */
  const navigate = (overrides: Partial<ApplicationListFilterState>) => {
    router.push(
      applicationListHref(
        {
          q,
          status,
          currentStage,
          jobOpeningId,
          view,
          sort: filters.sort,
          direction: filters.direction,
          pageSize: filters.pageSize,
          mine,
          needsAttention,
          ...overrides,
        },
        undefined,
        basePath
      )
    );
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        navigate({});
      }}
      className="flex w-full min-w-0 max-w-full flex-wrap items-end gap-4 rounded-xl border border-border bg-card p-5 shadow-subtle"
    >
      <div className="w-full min-w-[220px] flex-[2_1_240px] space-y-1.5">
        <label htmlFor="q" className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Search
        </label>
        <Input
          id="q"
          name="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Candidate name, email, job title…"
          className="h-10"
        />
      </div>

      <div className="min-w-[160px] flex-1 space-y-1.5">
        <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Job Opening
        </span>
        <Select
          value={jobOpeningId}
          onValueChange={(v) => {
            setJobOpeningId(v);
            navigate({ jobOpeningId: v });
          }}
        >
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

      <div className="min-w-[150px] flex-1 space-y-1.5">
        <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Status
        </span>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            navigate({ status: v });
          }}
        >
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

      <div className="min-w-[180px] flex-1 space-y-1.5">
        <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Pipeline Stage
        </span>
        <Select
          value={currentStage}
          onValueChange={(v) => {
            setCurrentStage(v);
            navigate({ currentStage: v });
          }}
        >
          <SelectTrigger className="h-10 bg-background" aria-label="Stage filter">
            <SelectValue placeholder="All Stages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            <SelectItem value="interviewing">INTERVIEWING (any round)</SelectItem>
            {Object.values(RecruitmentPipelineStage).map((s) => (
              <SelectItem key={s} value={s}>
                {s.replace("_", " ").toUpperCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex w-full flex-col justify-end gap-2 sm:w-auto">
        <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground md:hidden">
          View Mode
        </span>
        <div className="flex h-auto min-h-10 w-full flex-wrap items-center gap-3 sm:w-auto">
          <Button
            type="button"
            variant={mine ? "default" : "outline"}
            size="sm"
            onClick={() => {
              const next = !mine;
              setMine(next);
              navigate({ mine: next });
            }}
            className="h-8 gap-1.5 px-3 text-xs font-semibold"
            title="Show only applications assigned to me"
          >
            <UserRound className="h-3.5 w-3.5" />
            My Candidates
          </Button>
          <Button
            type="button"
            variant={needsAttention ? "default" : "outline"}
            size="sm"
            onClick={() => {
              const next = !needsAttention;
              setNeedsAttention(next);
              navigate({ needsAttention: next });
            }}
            className="h-8 gap-1.5 px-3 text-xs font-semibold"
            title="Decision pending, interview feedback missing, or stuck in stage over a week"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Needs Attention
          </Button>
          <div className="flex bg-muted p-1 rounded-lg border border-border/40">
            <Button
              type="button"
              variant={view === "board" ? "default" : "ghost"}
              size="icon"
              onClick={() => {
                setView("board");
                navigate({ view: "board" });
              }}
              className="h-8 w-8 rounded-md"
              title="Board View"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={view === "list" ? "default" : "ghost"}
              size="icon"
              onClick={() => {
                setView("list");
                navigate({ view: "list" });
              }}
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
