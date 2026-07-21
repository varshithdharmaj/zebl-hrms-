"use client";

import { useActionState, useState } from "react";
import { updateEmployeeProfileAction, type ActionState } from "@/actions/employees";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionCard } from "@/components/ui/section-card";
import { ErrorAlert } from "@/components/ui/error-alert";
import { EMPLOYEE_SHIFT_ASSIGNMENT_OPTIONS } from "@/lib/attendance-shift";
import { EMPLOYEE_STATUSES } from "@/lib/employee-types";
import { ManagerAssignmentFields } from "@/components/admin/employee-profile/manager-assignment";
import type { ProfileEmployee } from "@/components/admin/employee-profile/profile-shell";
import type { ManagerSummary } from "@/lib/org-types";

const initialState: ActionState = {};

export function BasicInfoTab({
  employee,
  managerCandidates,
}: {
  employee: ProfileEmployee;
  managerCandidates: ManagerSummary[];
}) {
  const [state, formAction, pending] = useActionState(updateEmployeeProfileAction, initialState);
  const [status, setStatus] = useState(employee.employeeStatus);
  const [shift, setShift] = useState(employee.shift ?? "");

  return (
    <SectionCard title="Basic information" description="Employee profile details">
      <form action={formAction} className="space-y-5">
        <input type="hidden" name="id" value={employee.id} />
        <input type="hidden" name="employeeStatus" value={status} />
        <input type="hidden" name="shift" value={shift} />
        {state.error && <ErrorAlert message={state.error} />}
        {state.success && (
          <p className="rounded-lg border border-success/20 bg-success-muted px-4 py-3 text-sm text-success">
            {state.success}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="employeeCode">Employee code</Label>
            <Input id="employeeCode" value={employee.employeeCode} disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" name="name" defaultValue={employee.name} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="firstName">First name</Label>
            <Input id="firstName" name="firstName" defaultValue={employee.firstName ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Last name</Label>
            <Input id="lastName" name="lastName" defaultValue={employee.lastName ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="preferredName">Preferred name</Label>
            <Input id="preferredName" name="preferredName" defaultValue={employee.preferredName ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gender">Gender</Label>
            <Input id="gender" name="gender" defaultValue={employee.gender ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dateOfBirth">Date of birth</Label>
            <Input
              id="dateOfBirth"
              name="dateOfBirth"
              type="date"
              defaultValue={employee.dateOfBirth
                ? new Date(employee.dateOfBirth).toISOString().split("T")[0]
                : ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" defaultValue={employee.email ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" name="phone" defaultValue={employee.phone ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="alternatePhone">Alternate phone</Label>
            <Input id="alternatePhone" name="alternatePhone" defaultValue={employee.alternatePhone ?? ""} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="address">Address</Label>
            <Input id="address" name="address" defaultValue={employee.address ?? ""} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="emergencyContact">Emergency contact</Label>
            <Input
              id="emergencyContact"
              name="emergencyContact"
              defaultValue={employee.emergencyContact ?? ""}
              placeholder="Name and phone number"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="department">Department</Label>
            <Input id="department" name="department" defaultValue={employee.department ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="designation">Designation</Label>
            <Input id="designation" name="designation" defaultValue={employee.designation ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="employmentType">Employment type</Label>
            <Input id="employmentType" name="employmentType" defaultValue={employee.employmentType ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="workLocation">Work location</Label>
            <Input id="workLocation" name="workLocation" defaultValue={employee.workLocation ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="shift">Shift</Label>
            <Select
              value={shift || "__none__"}
              onValueChange={(v) => setShift(v === "__none__" ? "" : v)}
            >
              <SelectTrigger id="shift">
                <SelectValue placeholder="Select shift" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Not set</SelectItem>
                {EMPLOYEE_SHIFT_ASSIGNMENT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.label}>
                    {opt.label}
                  </SelectItem>
                ))}
                {shift &&
                  !EMPLOYEE_SHIFT_ASSIGNMENT_OPTIONS.some((o) => o.label === shift) && (
                    <SelectItem value={shift}>{shift}</SelectItem>
                  )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="joiningDate">Joining date</Label>
            <Input
              id="joiningDate"
              name="joiningDate"
              type="date"
              defaultValue={new Date(employee.joiningDate).toISOString().split("T")[0]}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EMPLOYEE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <ManagerAssignmentFields
          employeeId={employee.id}
          currentManager={employee.manager}
          directReportsCount={employee.directReportsCount}
          candidates={managerCandidates}
        />

        {employee.user && (
          <p className="text-sm text-muted-foreground">
            Login: <span className="font-medium text-foreground">{employee.user.email}</span>
          </p>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </SectionCard>
  );
}
