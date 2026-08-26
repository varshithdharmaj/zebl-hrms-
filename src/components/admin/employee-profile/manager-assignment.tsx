"use client";

import { useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import type { ManagerSummary } from "@/lib/org-types";

type Props = {
  employeeId: number;
  currentManager: ManagerSummary | null;
  directReportsCount: number;
  candidates: ManagerSummary[];
};

export function ManagerAssignmentFields({
  employeeId,
  currentManager,
  directReportsCount,
  candidates,
}: Props) {
  const [managerId, setManagerId] = useState(
    currentManager ? String(currentManager.id) : "none"
  );
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.employeeCode.toLowerCase().includes(q) ||
        (c.department?.toLowerCase().includes(q) ?? false)
    );
  }, [candidates, search]);

  return (
    <div className="space-y-4 rounded-xl border border-border bg-muted/30 p-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Reporting structure</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Assign a direct manager for leave routing (workflow engine uses this in a later phase).
        </p>
      </div>

      <input type="hidden" name="managerId" value={managerId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Current manager</p>
          <p className="text-sm font-medium text-foreground">
            {currentManager
              ? `${currentManager.name} (${currentManager.employeeCode})`
              : "Not assigned"}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Direct reports</p>
          <p className="text-sm font-medium text-foreground">{directReportsCount}</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="managerSearch">Search managers</Label>
        <Input
          id="managerSearch"
          placeholder="Name or employee code…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>Reports to</Label>
        <Select value={managerId} onValueChange={setManagerId}>
          <SelectTrigger>
            <SelectValue placeholder="Select manager" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No manager</SelectItem>
            {filtered.map((c) => (
              <SelectItem key={c.id} value={String(c.id)} disabled={c.id === employeeId}>
                {c.name} · {c.employeeCode}
                {c.department ? ` · ${c.department}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
