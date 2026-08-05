"use client";

import React, { useState } from "react";
import { InterviewRoundType, InterviewStatus } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";

export type InterviewFilterState = {
  status: string;
  roundType: string;
  q: string;
};

export function InterviewFilters({
  filters,
  onFilterChange,
}: {
  filters: InterviewFilterState;
  onFilterChange: (filters: InterviewFilterState) => void;
}) {
  const [q, setQ] = useState(filters.q);
  const [status, setStatus] = useState(filters.status);
  const [roundType, setRoundType] = useState(filters.roundType);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFilterChange({ q, status, roundType });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-4 rounded-xl border border-border bg-card p-5 shadow-subtle sm:grid-cols-2 md:grid-cols-4"
    >
      <div>
        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
          Search
        </label>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Candidate or interview title..."
          className="w-full h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
          Status
        </label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="all">All Statuses</option>
          <option value={InterviewStatus.draft}>Draft</option>
          <option value={InterviewStatus.scheduled}>Scheduled</option>
          <option value={InterviewStatus.completed}>Completed</option>
          <option value={InterviewStatus.cancelled}>Cancelled</option>
          <option value={InterviewStatus.no_show}>No Show</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
          Round Type
        </label>
        <select
          value={roundType}
          onChange={(e) => setRoundType(e.target.value)}
          className="w-full h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="all">All Rounds</option>
          <option value={InterviewRoundType.screening}>Screening</option>
          <option value={InterviewRoundType.hr}>HR</option>
          <option value={InterviewRoundType.technical}>Technical</option>
          <option value={InterviewRoundType.team_lead}>Team Lead</option>
          <option value={InterviewRoundType.manager}>Manager</option>
          <option value={InterviewRoundType.client}>Client</option>
          <option value={InterviewRoundType.other}>Other</option>
        </select>
      </div>

      <div className="flex flex-col justify-end">
        <Button type="submit" className="font-semibold shadow-subtle h-9">
          Apply Filters
        </Button>
      </div>
    </form>
  );
}
