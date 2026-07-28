"use client";

import { useState, useTransition } from "react";
import {
  forceLogoutSessionAction,
  logoutAllOwnSessionsAction,
  logoutSessionAction,
} from "@/actions/security";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type RevokeMode = "employee" | "admin";

export function SessionRevokeButton({
  sessionId,
  mode,
  isCurrent,
  label = "Sign out",
}: {
  sessionId: string;
  mode: RevokeMode;
  isCurrent?: boolean;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const action = mode === "employee" ? logoutSessionAction : forceLogoutSessionAction;

  const title = isCurrent ? "Sign out this device?" : "Sign out this session?";
  const description = isCurrent
    ? "You will be signed out immediately and redirected to the login page."
    : "That device will lose access until the user signs in again.";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const fd = new FormData();
                fd.set("sessionId", sessionId);
                await action(fd);
                setOpen(false);
              });
            }}
          >
            {pending ? "Signing out…" : "Confirm sign out"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function LogoutAllSessionsButton() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="destructive" size="sm">
          Log out all sessions
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log out all sessions?</DialogTitle>
          <DialogDescription>
            Every device signed into your account will be revoked, including this one.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                await logoutAllOwnSessionsAction();
              });
            }}
          >
            {pending ? "Signing out…" : "Log out everywhere"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
