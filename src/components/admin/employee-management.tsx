"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Plus, ChevronRight } from "lucide-react";
import { createEmployeeAction, type ActionState } from "@/actions/employees";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SectionCard } from "@/components/ui/section-card";
import { DataTable, DataTableRow, DataTableCell } from "@/components/ui/data-table";
import { ErrorAlert } from "@/components/ui/error-alert";
import { StatusBadge } from "@/components/ui/status-badge";
import { EMPLOYEE_STATUSES } from "@/lib/employee-types";

type Employee = {
  id: number;
  employeeCode: string;
  name: string;
  email: string | null;
  phone: string | null;
  department: string | null;
  designation: string | null;
  shift: string | null;
  joiningDate: Date;
  employeeStatus: string;
  user: { email: string } | null;
};

const initialState: ActionState = {};

export function EmployeeManagement({ employees }: { employees: Employee[] }) {
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  // Reset to first page when search changes
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setCurrentPage(1);
  };

  const filtered = employees.filter((e) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      e.name.toLowerCase().includes(q) ||
      e.employeeCode.toLowerCase().includes(q) ||
      (e.email?.toLowerCase().includes(q) ?? false) ||
      (e.phone?.toLowerCase().includes(q) ?? false)
    );
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedEmployees = filtered.slice(startIndex, startIndex + itemsPerPage);

  return (
    <SectionCard noPadding>
      <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Search employees…"
          value={search}
          onChange={handleSearchChange}
          className="max-w-sm"
        />
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Add employee
        </Button>
      </div>

      <DataTable columns={["Code", "Name", "Role", "Department", "Joined", "Status", ""]}>
        {paginatedEmployees.map((emp) => (
          <DataTableRow key={emp.id}>
            <DataTableCell className="font-mono text-xs text-muted-foreground">
              {emp.employeeCode}
            </DataTableCell>
            <DataTableCell>
              <p className="font-medium">{emp.name}</p>
              {emp.email && <p className="text-xs text-muted-foreground">{emp.email}</p>}
            </DataTableCell>
            <DataTableCell>{emp.designation ?? "—"}</DataTableCell>
            <DataTableCell>{emp.department ?? "—"}</DataTableCell>
            <DataTableCell className="text-muted-foreground">
              {new Date(emp.joiningDate).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </DataTableCell>
            <DataTableCell>
              <StatusBadge status={emp.employeeStatus} />
            </DataTableCell>
            <DataTableCell>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/admin/employees/${emp.id}`}>
                  Profile
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </DataTableCell>
          </DataTableRow>
        ))}
      </DataTable>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border p-4">
          <p className="text-sm text-muted-foreground">
            Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filtered.length)} of {filtered.length} employees
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span className="text-sm font-medium">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <CreateEmployeeDialog open={createOpen} onOpenChange={setCreateOpen} />
    </SectionCard>
  );
}

function CreateEmployeeDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, formAction, pending] = useActionState(createEmployeeAction, initialState);
  const [status, setStatus] = useState("Active");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add employee</DialogTitle>
          <DialogDescription>Create a new employee record</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="employeeStatus" value={status} />
          {state.error && <ErrorAlert message={state.error} />}
          {state.success && (
            <p className="rounded-lg border border-success/20 bg-success-muted px-4 py-3 text-sm text-success">
              {state.success}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="employeeCode">Employee code</Label>
              <Input id="employeeCode" name="employeeCode" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="joiningDate">Joining date</Label>
              <Input id="joiningDate" name="joiningDate" type="date" required />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
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
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" type="tel" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Input id="department" name="department" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="designation">Designation</Label>
              <Input id="designation" name="designation" />
            </div>
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <p className="text-sm font-medium">Initial leave (optional)</p>
            <div className="mt-3 grid grid-cols-3 gap-3">
              {(["initialEl", "initialCl", "initialSl"] as const).map((name, i) => (
                <div key={name} className="space-y-1">
                  <Label className="text-xs">{["EL", "CL", "SL"][i]}</Label>
                  <Input name={name} type="number" step="0.5" min="0" placeholder="0" />
                </div>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="createLogin" className="rounded border-input" />
            Create login
          </label>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" minLength={8} />
          </div>
          <Button type="submit" loading={pending} className="w-full">
            {pending ? "Creating…" : "Create employee"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
