import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginHistoryFilters({
  filters,
  basePath,
  admin = false,
  departments = [],
}: {
  filters: Record<string, string | undefined>;
  basePath: string;
  admin?: boolean;
  departments?: string[];
}) {
  return (
    <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Input
        name="q"
        placeholder={admin ? "Employee, email, browser or IP" : "Browser or IP"}
        defaultValue={filters.q ?? ""}
      />
      <select
        name="status"
        defaultValue={filters.status ?? ""}
        className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
      >
        <option value="">All statuses</option>
        <option value="active">Active</option>
        <option value="logged_out">Logged out</option>
        <option value="expired">Expired</option>
        <option value="revoked">Revoked</option>
        {admin && <option value="failed">Failed</option>}
      </select>
      <Input name="from" type="date" aria-label="From date" defaultValue={filters.from ?? ""} />
      <Input name="to" type="date" aria-label="To date" defaultValue={filters.to ?? ""} />
      {admin && (
        <>
          <select
            name="role"
            defaultValue={filters.role ?? ""}
            className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
          >
            <option value="">All roles</option>
            <option value="employee">Employee</option>
            <option value="hr">HR</option>
            <option value="super_admin">Super Admin</option>
          </select>
          <select
            name="department"
            defaultValue={filters.department ?? ""}
            className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
          >
            <option value="">All departments</option>
            {departments.map((department) => (
              <option key={department} value={department}>
                {department}
              </option>
            ))}
          </select>
          <Input name="browser" placeholder="Browser" defaultValue={filters.browser ?? ""} />
        </>
      )}
      <input type="hidden" name="page" value="1" />
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm">Apply</Button>
        <Button type="button" variant="outline" size="sm" asChild>
          <Link href={basePath}>Reset</Link>
        </Button>
      </div>
    </form>
  );
}
