"use client";

import { useActionState } from "react";
import { uploadAttendanceAction, type UploadState } from "@/actions/upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionCard } from "@/components/ui/section-card";
import { ErrorAlert } from "@/components/ui/error-alert";
import { EXPECTED_EXCEL_COLUMNS } from "@/lib/attendance";

const initialState: UploadState = {};

export function UploadForm({ defaultDate }: { defaultDate: string }) {
  const [state, formAction, pending] = useActionState(uploadAttendanceAction, initialState);

  return (
    <SectionCard title="Excel import" description={EXPECTED_EXCEL_COLUMNS.join(" · ")} className="max-w-xl">
      <form action={formAction} className="space-y-4">
        {state.error && <ErrorAlert message={state.error} />}
        {state.success && (
          <p className="rounded-lg border border-success/20 bg-success-muted px-4 py-3 text-sm text-success">
            {state.success}
          </p>
        )}
        <div className="space-y-2">
          <Label htmlFor="attendanceDate">Attendance date</Label>
          <Input id="attendanceDate" name="attendanceDate" type="date" defaultValue={defaultDate} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="file">File (.xlsx)</Label>
          <Input id="file" name="file" type="file" accept=".xlsx,.xls" required />
        </div>
        <ul className="space-y-1 text-xs text-muted-foreground">
          <li>≥ 480 min worked = Present</li>
          <li>&lt; 480 min = Short hours</li>
          <li>No check-in = Absent</li>
        </ul>
        <Button type="submit" disabled={pending}>
          {pending ? "Uploading…" : "Import"}
        </Button>
      </form>
    </SectionCard>
  );
}
