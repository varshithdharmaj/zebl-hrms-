"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "@/components/ui/button";

/** Controlled confirm dialog used across recruitment tables/detail views. */
export interface AlertDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  cancelLabel?: string;
  actionLabel?: string;
  onAction: () => void;
  isActionDestructive?: boolean;
  isPending?: boolean;
}

type AlertDialogRootProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Root>;

function isControlledAlertDialogProps(
  props: AlertDialogProps | AlertDialogRootProps
): props is AlertDialogProps {
  return "isOpen" in props && "onAction" in props && "title" in props;
}

function ControlledAlertDialog({
  isOpen,
  onOpenChange,
  title,
  description,
  cancelLabel = "Cancel",
  actionLabel = "Confirm",
  onAction,
  isActionDestructive = false,
  isPending = false,
}: AlertDialogProps) {
  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm transition-opacity" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 shadow-elevated focus:outline-none animate-in fade-in-50 zoom-in-95 duration-200">
          <div className="space-y-4">
            <div className="space-y-2">
              <DialogPrimitive.Title className="text-lg font-semibold text-foreground">
                {title}
              </DialogPrimitive.Title>
              {description && (
                <DialogPrimitive.Description className="text-sm text-muted-foreground leading-relaxed">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2 sm:gap-0">
              <DialogPrimitive.Close asChild>
                <Button variant="outline" size="sm" disabled={isPending}>
                  {cancelLabel}
                </Button>
              </DialogPrimitive.Close>
              <Button
                variant={isActionDestructive ? "destructive" : "default"}
                size="sm"
                onClick={() => {
                  onAction();
                }}
                disabled={isPending}
              >
                {isPending ? "Processing..." : actionLabel}
              </Button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/**
 * Dual API:
 * - Controlled confirm: `<AlertDialog isOpen title onAction … />`
 * - Compound (shadcn-style): `<AlertDialog><AlertDialogTrigger>…`
 */
export function AlertDialog(props: AlertDialogProps | AlertDialogRootProps) {
  if (isControlledAlertDialogProps(props)) {
    return <ControlledAlertDialog {...props} />;
  }
  return <DialogPrimitive.Root data-slot="alert-dialog" {...props} />;
}

const AlertDialogTrigger = DialogPrimitive.Trigger;

const AlertDialogPortal = DialogPrimitive.Portal;

const AlertDialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm transition-opacity",
      className
    )}
    {...props}
  />
));
AlertDialogOverlay.displayName = "AlertDialogOverlay";

const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AlertDialogPortal>
    <AlertDialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 shadow-elevated focus:outline-none animate-in fade-in-50 zoom-in-95 duration-200",
        className
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </AlertDialogPortal>
));
AlertDialogContent.displayName = "AlertDialogContent";

function AlertDialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />;
}

function AlertDialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2 sm:gap-0",
        className
      )}
      {...props}
    />
  );
}

const AlertDialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold text-foreground", className)}
    {...props}
  />
));
AlertDialogTitle.displayName = "AlertDialogTitle";

const AlertDialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground leading-relaxed", className)}
    {...props}
  />
));
AlertDialogDescription.displayName = "AlertDialogDescription";

const AlertDialogCancel = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "outline", size = "sm", ...props }, ref) => (
    <DialogPrimitive.Close asChild>
      <Button ref={ref} variant={variant} size={size} className={className} {...props} />
    </DialogPrimitive.Close>
  )
);
AlertDialogCancel.displayName = "AlertDialogCancel";

const AlertDialogAction = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "sm", ...props }, ref) => (
    <DialogPrimitive.Close asChild>
      <Button ref={ref} variant={variant} size={size} className={className} {...props} />
    </DialogPrimitive.Close>
  )
);
AlertDialogAction.displayName = "AlertDialogAction";

export {
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
};
