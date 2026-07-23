"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { AccountStatus } from "@/generated/prisma/enums";
import {
  changeUserRoleAction,
  resetUserPasswordAction,
  updateAccountStatusAction,
  updateUserIdentityAction,
  type ActionState,
} from "@/actions/user-management";
import type { ProfileEmployee } from "@/components/admin/employee-profile/profile-shell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ErrorAlert } from "@/components/ui/error-alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { ROLE_LABELS, USER_ROLES, type AppUserRole } from "@/lib/roles";

const initialState: ActionState = {};

function Feedback({ state }: { state: ActionState }) {
  return (
    <>
      {state.error && <ErrorAlert message={state.error} />}
      {state.success && (
        <p className="rounded-lg border border-success/20 bg-success-muted px-3 py-2 text-sm text-success">
          {state.success}
        </p>
      )}
    </>
  );
}

export function AccountManagementTab({
  employee,
  currentUserId,
  currentUserRole,
}: {
  employee: ProfileEmployee;
  currentUserId: string;
  currentUserRole: AppUserRole;
}) {
  const user = employee.user;
  const [identityState, identityAction, identityPending] = useActionState(
    updateUserIdentityAction,
    initialState
  );
  const [passwordState, passwordAction, passwordPending] = useActionState(
    resetUserPasswordAction,
    initialState
  );
  const [statusState, statusAction, statusPending] = useActionState(
    updateAccountStatusAction,
    initialState
  );
  const [roleState, roleAction, rolePending] = useActionState(
    changeUserRoleAction,
    initialState
  );
  const [passwordMode, setPasswordMode] = useState<"manual" | "generated">("generated");

  if (!user) {
    return (
      <SectionCard title="Account Management" description="No login account is linked">
        <p className="text-sm text-muted-foreground">
          Create or link a login account from User Management before administering security settings.
        </p>
      </SectionCard>
    );
  }

  const canAdminister =
    currentUserRole === "super_admin" ||
    (currentUserRole === "hr" && user.role === "employee");
  const isSelf = currentUserId === user.id;

  return (
    <div className="space-y-6">
      <SectionCard title="Account Information" description="Login identity and account state">
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Role</p>
            <p className="font-medium">{ROLE_LABELS[user.role]}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <StatusBadge status={user.accountStatus} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Last login</p>
            <p className="font-medium">
              {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "Never"}
            </p>
          </div>
        </div>

        <form action={identityAction} className="space-y-4">
          <input type="hidden" name="userId" value={user.id} />
          <Feedback state={identityState} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="account-email">Login email</Label>
              <Input
                id="account-email"
                name="email"
                type="email"
                defaultValue={user.email}
                disabled={!canAdminister}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                defaultValue={user.username ?? ""}
                disabled={!canAdminister}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="profilePhotoUrl">Profile photo URL</Label>
              <Input
                id="profilePhotoUrl"
                name="profilePhotoUrl"
                type="url"
                defaultValue={user.profilePhotoUrl ?? ""}
                disabled={!canAdminister}
                placeholder="https://…"
              />
            </div>
          </div>
          {canAdminister && (
            <Button type="submit" disabled={identityPending}>
              {identityPending ? "Saving…" : "Save account information"}
            </Button>
          )}
        </form>
      </SectionCard>

      <SectionCard title="Security" description="Password, status, sessions, and permissions">
        {!canAdminister && (
          <ErrorAlert message="Your role cannot administer this protected account." />
        )}
        <div className="flex flex-wrap gap-2">
          {canAdminister && user.authProvider === "local" && (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">Reset Password</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Reset password</DialogTitle>
                  <DialogDescription>
                    Existing sessions will be revoked. The current password is never displayed.
                  </DialogDescription>
                </DialogHeader>
                <form action={passwordAction} className="space-y-4">
                  <input type="hidden" name="userId" value={user.id} />
                  <input type="hidden" name="mode" value={passwordMode} />
                  <Feedback state={passwordState} />
                  {passwordState.temporaryPassword && (
                    <div className="rounded-lg border border-warning/30 bg-warning-muted p-3">
                      <p className="text-xs font-semibold">Temporary password — copy it now</p>
                      <code className="mt-1 block select-all text-sm">
                        {passwordState.temporaryPassword}
                      </code>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={passwordMode === "generated" ? "default" : "outline"}
                      onClick={() => setPasswordMode("generated")}
                    >
                      Generate temporary
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={passwordMode === "manual" ? "default" : "outline"}
                      onClick={() => setPasswordMode("manual")}
                    >
                      Set manually
                    </Button>
                  </div>
                  {passwordMode === "manual" && (
                    <div className="grid gap-3">
                      <Input name="password" type="password" placeholder="New password" minLength={8} required />
                      <Input name="confirmPassword" type="password" placeholder="Confirm password" minLength={8} required />
                    </div>
                  )}
                  <label className="flex items-center gap-2 text-sm">
                    <input name="mustChangePassword" type="checkbox" defaultChecked />
                    User must change password on next login
                  </label>
                  <Button type="submit" disabled={passwordPending}>
                    {passwordPending ? "Resetting…" : "Confirm password reset"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
          {canAdminister && user.authProvider === "microsoft" && (
            <p className="self-center text-sm text-muted-foreground">
              Password is managed by Microsoft.
            </p>
          )}

          {canAdminister && !isSelf && (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant={user.accountStatus === AccountStatus.active ? "destructive" : "outline"}>
                  Change Account Status
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Change account status</DialogTitle>
                  <DialogDescription>
                    Non-active states immediately revoke all login sessions.
                  </DialogDescription>
                </DialogHeader>
                <form action={statusAction} className="space-y-4">
                  <input type="hidden" name="userId" value={user.id} />
                  <Feedback state={statusState} />
                  <div className="space-y-2">
                    <Label htmlFor="account-status">Status</Label>
                    <select
                      id="account-status"
                      name="status"
                      defaultValue={user.accountStatus}
                      className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                    >
                      {Object.values(AccountStatus).map((status) => (
                        <option key={status} value={status}>
                          {status.replace("_", " ")}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status-reason">Reason</Label>
                    <Input id="status-reason" name="reason" placeholder="Optional reason" />
                  </div>
                  <Button type="submit" variant="destructive" disabled={statusPending}>
                    {statusPending ? "Saving…" : "Confirm status change"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}

          {currentUserRole === "super_admin" && !isSelf && (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">Role Management</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Change role</DialogTitle>
                  <DialogDescription>
                    Role changes revoke all existing sessions and take effect immediately.
                  </DialogDescription>
                </DialogHeader>
                <form action={roleAction} className="space-y-4">
                  <input type="hidden" name="userId" value={user.id} />
                  <Feedback state={roleState} />
                  <select
                    name="role"
                    defaultValue={user.role}
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  >
                    {USER_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </option>
                    ))}
                  </select>
                  <Button type="submit" disabled={rolePending}>
                    {rolePending ? "Saving…" : "Confirm role change"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-4 text-sm">
          <Link
            href={`/admin/security/login-history?employeeId=${employee.id}`}
            className="text-primary hover:underline"
          >
            View Login History
          </Link>
          <Link href="/admin/security/active-sessions" className="text-primary hover:underline">
            View Active Sessions
          </Link>
          <Link href={`/admin/audit?q=${user.id}`} className="text-primary hover:underline">
            View Audit History
          </Link>
        </div>
      </SectionCard>
    </div>
  );
}
