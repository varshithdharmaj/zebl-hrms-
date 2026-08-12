"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  deleteReportPresetAction,
  saveReportPresetAction,
} from "@/actions/recruitment-reports";
import type { ReportSectionKey, SavedReportPreset } from "@/lib/recruitment/reports/types";

export function ReportFilters({
  section,
  presets,
}: {
  section: ReportSectionKey;
  presets: SavedReportPreset[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);

  const [startDate, setStartDate] = useState(
    searchParams.get("startDate") ??
      (() => {
        const d = new Date();
        d.setDate(d.getDate() - 6);
        return d.toISOString().slice(0, 10);
      })()
  );
  const [endDate, setEndDate] = useState(
    searchParams.get("endDate") ?? new Date().toISOString().slice(0, 10)
  );
  const [department, setDepartment] = useState(searchParams.get("department") ?? "");
  const [recruiterUserId, setRecruiterUserId] = useState(
    searchParams.get("recruiterUserId") ?? ""
  );
  const [jobOpeningId, setJobOpeningId] = useState(searchParams.get("jobOpeningId") ?? "");
  const [location, setLocation] = useState(searchParams.get("location") ?? "");
  const [employmentType, setEmploymentType] = useState(
    searchParams.get("employmentType") ?? ""
  );
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") ?? "");
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [presetName, setPresetName] = useState("");

  const apply = () => {
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (department) params.set("department", department);
    if (recruiterUserId) params.set("recruiterUserId", recruiterUserId);
    if (jobOpeningId) params.set("jobOpeningId", jobOpeningId);
    if (location) params.set("location", location);
    if (employmentType) params.set("employmentType", employmentType);
    if (statusFilter) params.set("status", statusFilter);
    if (search) params.set("search", search);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const loadPreset = (preset: SavedReportPreset) => {
    const params = new URLSearchParams();
    const start = preset.filters.dateRange?.startDate;
    const end = preset.filters.dateRange?.endDate;
    if (start) params.set("startDate", start.toISOString().slice(0, 10));
    if (end) params.set("endDate", end.toISOString().slice(0, 10));
    if (preset.filters.department) params.set("department", preset.filters.department);
    if (preset.filters.recruiterUserId) {
      params.set("recruiterUserId", preset.filters.recruiterUserId);
    }
    if (preset.filters.jobOpeningId) params.set("jobOpeningId", preset.filters.jobOpeningId);
    if (preset.filters.location) params.set("location", preset.filters.location);
    if (preset.filters.employmentType) {
      params.set("employmentType", preset.filters.employmentType);
    }
    if (preset.filters.status) params.set("status", preset.filters.status);
    if (preset.filters.search) params.set("search", preset.filters.search);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-subtle">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-1">
          <Label htmlFor="startDate">Start date</Label>
          <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="endDate">End date</Label>
          <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="department">Department</Label>
          <Input id="department" value={department} onChange={(e) => setDepartment(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="recruiterUserId">Recruiter</Label>
          <Input id="recruiterUserId" value={recruiterUserId} onChange={(e) => setRecruiterUserId(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="jobOpeningId">Job opening</Label>
          <Input id="jobOpeningId" value={jobOpeningId} onChange={(e) => setJobOpeningId(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="location">Location</Label>
          <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="employmentType">Employment type</Label>
          <Input id="employmentType" value={employmentType} onChange={(e) => setEmploymentType(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="status">Status / source</Label>
          <Input id="status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} />
        </div>
        <div className="space-y-1 md:col-span-2">
          <Label htmlFor="search">Search</Label>
          <Input id="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search table values…" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={apply} loading={isPending}>
          {isPending ? "Applying…" : "Apply filters"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => {
            setStartDate("");
            setEndDate("");
            setDepartment("");
            setRecruiterUserId("");
            setJobOpeningId("");
            setLocation("");
            setEmploymentType("");
            setStatusFilter("");
            setSearch("");
            startTransition(() => router.push(pathname));
          }}
        >
          Reset
        </Button>
        <Input
          value={presetName}
          onChange={(e) => setPresetName(e.target.value)}
          placeholder="Preset name"
          className="h-9 w-40"
          aria-label="Preset name"
        />
        <Button
          size="sm"
          variant="outline"
          disabled={isPending || !presetName.trim()}
          onClick={() => {
            startTransition(async () => {
              const result = await saveReportPresetAction(
                {},
                {
                  name: presetName.trim(),
                  section,
                  isDefault: false,
                  filters: {
                    startDate,
                    endDate,
                    department,
                    recruiterUserId,
                    jobOpeningId,
                    location,
                    employmentType,
                    status: statusFilter,
                    search,
                  },
                }
              );
              setStatus(result.error ?? result.success ?? null);
              if (!result.error) {
                setPresetName("");
                router.refresh();
              }
            });
          }}
        >
          Save preset
        </Button>
      </div>

      {presets.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <div key={preset.id} className="flex items-center gap-1">
              <Button size="sm" variant="outline" onClick={() => loadPreset(preset)}>
                {preset.name}
                {preset.isDefault ? " ★" : ""}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Delete preset ${preset.name}`}
                onClick={() => {
                  startTransition(async () => {
                    await deleteReportPresetAction({}, { id: preset.id });
                    router.refresh();
                  });
                }}
              >
                ×
              </Button>
            </div>
          ))}
        </div>
      )}

      {status && (
        <p className="text-xs text-muted-foreground" role="status">
          {status}
        </p>
      )}
    </section>
  );
}
