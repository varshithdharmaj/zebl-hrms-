"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function CommunicationSearch({
  defaultValue = "",
  name = "q",
}: {
  defaultValue?: string;
  name?: string;
}) {
  return (
    <div className="relative">
      <label htmlFor="communication-search" className="sr-only">
        Search communications
      </label>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        aria-hidden
      />
      <Input
        id="communication-search"
        name={name}
        type="search"
        defaultValue={defaultValue}
        placeholder="Search subject, candidate, recruiter..."
        className="h-10 pl-9"
        autoComplete="off"
      />
    </div>
  );
}
