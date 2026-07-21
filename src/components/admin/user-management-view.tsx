"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  changeUserRoleAction,
  setUserActiveAction,
  type ActionState,
} from "@/actions/user-management";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";
import { DataTable, DataTableRow, DataTableCell } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { ROLE_LABELS, USER_ROLES, type AppUserRole } from "@/lib/roles";
import type { AdminUserListItem } from "@/lib/admin/user-management";
import { cn } from "@/lib/utils";

const initialState: ActionState = {};

function FilterPill({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-slate-900 text-white"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      )}
    >
      {label}
    </Link>
  );
}

function UserRow({
  user,
  isSelf,
}: {
  user: AdminUserListItem;
  isSelf: boolean;
}) {
  const [roleState, roleAction, rolePending] = useActionState(
    changeUserRoleAction,
    initialState
  );
  const [statusState, statusAction, statusPending] = useActionState(
    setUserActiveAction,
    initialState
  );

  return (
    <DataTableRow>
      <DataTableCell>
        {user.employeeId ? (
          <Link
            href={`/admin/employees/${user.employeeId}`}
            className="font-medium text-foreground hover:text-primary hover:underline"
          >
            {user.employeeName ?? "Employee account"}
          </Link>
        ) : (
          <div className="font-medium text-foreground">—</div>
        )}
        <div className="text-xs text-muted-foreground">{user.email}</div>
      </DataTableCell>
      <DataTableCell>
        <form action={roleAction} className="flex items-center gap-2">
          <input type="hidden" name="userId" value={user.id} />
          <select
            name="role"
            defaultValue={user.role}
            disabled={isSelf || rolePending}
            className="h-8.5 rounded-lg border border-input bg-card px-2 text-xs shadow-subtle disabled:cursor-not-allowed disabled:opacity-50"
          >
            {USER_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          {!isSelf && (
            <Button type="submit" size="sm" variant="outline" disabled={rolePending}>
              {rolePending ? "Saving…" : "Save"}
            </Button>
          )}
        </form>
        {roleState.error && (
          <p className="mt-1 max-w-[220px] text-xs text-danger">{roleState.error}</p>
        )}
      </DataTableCell>
      <DataTableCell>
        <StatusBadge status={user.isActive ? "active" : "inactive"} />
      </DataTableCell>
      <DataTableCell>{user.authProvider}</DataTableCell>
      <DataTableCell>
        {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : "Never"}
      </DataTableCell>
      <DataTableCell>
        {isSelf ? (
          <span className="text-xs text-muted-foreground">You</span>
        ) : (
          <form action={statusAction}>
            <input type="hidden" name="userId" value={user.id} />
            <input type="hidden" name="isActive" value={(!user.isActive).toString()} />
            <Button
              type="submit"
              size="sm"
              variant={user.isActive ? "destructive" : "outline"}
              disabled={statusPending}
            >
              {statusPending
                ? "Saving…"
                : user.isActive
                  ? "Deactivate"
                  : "Activate"}
            </Button>
          </form>
        )}
        {statusState.error && (
          <p className="mt-1 max-w-[220px] text-xs text-danger">{statusState.error}</p>
        )}
      </DataTableCell>
    </DataTableRow>
  );
}

export function UserManagementView({
  users,
  total,
  page,
  pageSize,
  currentUserId,
  filters,
}: {
  users: AdminUserListItem[];
  total: number;
  page: number;
  pageSize: number;
  currentUserId: string;
  filters: { q?: string; role?: AppUserRole; status?: "active" | "inactive" };
}) {
  const searchParams = useSearchParams();

  function buildFilterHref(next: Record<string, string | undefined>): string {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    // Changing a filter resets pagination.
    params.delete("page");
    const qs = params.toString();
    return qs ? `/admin/user-management?${qs}` : "/admin/user-management";
  }

  function buildPageHref(targetPage: number): string {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(targetPage));
    return `/admin/user-management?${params.toString()}`;
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <SectionCard noPadding>
      <div className="flex flex-col gap-3 border-b border-border p-5">
        <form action="/admin/user-management" className="flex max-w-sm gap-2">
          {filters.role && <input type="hidden" name="role" value={filters.role} />}
          {filters.status && <input type="hidden" name="status" value={filters.status} />}
          <Input
            type="search"
            name="q"
            placeholder="Search by name or email…"
            defaultValue={filters.q ?? ""}
          />
          <Button type="submit" variant="outline" size="sm">
            Search
          </Button>
        </form>
        <div className="flex flex-wrap gap-2">
          <span className="text-xs font-semibold text-muted-foreground self-center mr-1">
            Role:
          </span>
          <FilterPill label="All" href={buildFilterHref({ role: undefined })} active={!filters.role} />
          {USER_ROLES.map((r) => (
            <FilterPill
              key={r}
              label={ROLE_LABELS[r]}
              href={buildFilterHref({ role: r })}
              active={filters.role === r}
            />
          ))}
          <span className="text-xs font-semibold text-muted-foreground self-center ml-3 mr-1">
            Status:
          </span>
          <FilterPill
            label="All"
            href={buildFilterHref({ status: undefined })}
            active={!filters.status}
          />
          <FilterPill
            label="Active"
            href={buildFilterHref({ status: "active" })}
            active={filters.status === "active"}
          />
          <FilterPill
            label="Inactive"
            href={buildFilterHref({ status: "inactive" })}
            active={filters.status === "inactive"}
          />
        </div>
      </div>

      <DataTable
        columns={["User", "Role", "Status", "Provider", "Last login", "Actions"]}
        emptyMessage="No users found."
      >
        {users.map((user) => (
          <UserRow key={user.id} user={user} isSelf={user.id === currentUserId} />
        ))}
      </DataTable>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={buildPageHref(page - 1)}
                className="rounded-lg border border-border px-3 py-1.5 hover:bg-slate-50"
              >
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={buildPageHref(page + 1)}
                className="rounded-lg border border-border px-3 py-1.5 hover:bg-slate-50"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </SectionCard>
  );
}
