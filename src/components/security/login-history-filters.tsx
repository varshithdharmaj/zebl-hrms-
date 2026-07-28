import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ADVANCED_KEYS = ["from", "to", "role", "department", "browser"] as const;

function hasAdvancedFilters(filters: Record<string, string | undefined>): boolean {
  return ADVANCED_KEYS.some((key) => Boolean(filters[key]));
}

export function LoginHistoryFilters({
  filters,
  basePath,
  admin = false,
  allowFailedStatus = false,
  departments = [],
}: {
  filters: Record<string, string | undefined>;
  basePath: string;
  admin?: boolean;
  /** Failed attempts are Super Admin–only; do not show the option to HR. */
  allowFailedStatus?: boolean;
  departments?: string[];
}) {
  const advancedOpen = hasAdvancedFilters(filters);

  return (
    <form method="get" className="space-y-3">
      {filters.employeeId ? (
        <input type="hidden" name="employeeId" value={filters.employeeId} />
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-0 flex-1 space-y-1.5 sm:min-w-[14rem]">
          <Label htmlFor="security-session-search">Search</Label>
          <Input
            id="security-session-search"
            name="q"
            placeholder={admin ? "Employee, email, browser or IP" : "Browser or IP"}
            defaultValue={filters.q ?? ""}
          />
        </div>
        <div className="space-y-1.5 sm:w-44">
          <Label htmlFor="security-session-status">Status</Label>
          <select
            id="security-session-status"
            name="status"
            defaultValue={filters.status ?? ""}
            className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
          >
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="ended">Ended</option>
            <option value="expired">Expired</option>
            <option value="revoked">Revoked</option>
            {allowFailedStatus && <option value="failed">Failed</option>}
            {filters.status === "logged_out" && (
              <option value="logged_out">Ended (legacy)</option>
            )}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Button type="submit" size="sm">
            Apply
          </Button>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href={basePath}>Reset</Link>
          </Button>
        </div>
      </div>

      <details className="rounded-xl border border-border bg-muted/20 px-3 py-2" open={advancedOpen || undefined}>
        <summary className="cursor-pointer select-none text-sm font-medium text-foreground">
          Advanced filters
        </summary>
        <div className="mt-3 grid gap-3 border-t border-border pt-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="security-session-from">From</Label>
            <Input
              id="security-session-from"
              name="from"
              type="date"
              defaultValue={filters.from ?? ""}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="security-session-to">To</Label>
            <Input
              id="security-session-to"
              name="to"
              type="date"
              defaultValue={filters.to ?? ""}
            />
          </div>
          {admin && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="security-session-role">Role</Label>
                <select
                  id="security-session-role"
                  name="role"
                  defaultValue={filters.role ?? ""}
                  className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                >
                  <option value="">All roles</option>
                  <option value="employee">Employee</option>
                  <option value="hr">HR</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="security-session-department">Department</Label>
                <select
                  id="security-session-department"
                  name="department"
                  defaultValue={filters.department ?? ""}
                  className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                >
                  <option value="">All departments</option>
                  {departments.map((department) => (
                    <option key={department} value={department}>
                      {department}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                <Label htmlFor="security-session-browser">Browser</Label>
                <Input
                  id="security-session-browser"
                  name="browser"
                  placeholder="Browser"
                  defaultValue={filters.browser ?? ""}
                />
              </div>
            </>
          )}
        </div>
      </details>

      <input type="hidden" name="page" value="1" />
    </form>
  );
}
