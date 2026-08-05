import React from "react";
import Link from "next/link";
import { AlertCircle, ShieldAlert, Ban, RefreshCw, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface CandidateErrorViewProps {
  type: "not_found" | "permission_denied" | "disabled" | "unexpected";
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function CandidateErrorView({
  type,
  message,
  onRetry,
  className,
}: CandidateErrorViewProps) {
  const config = {
    not_found: {
      icon: AlertCircle,
      title: "Candidate Not Found",
      description:
        message ||
        "The candidate profile you are looking for does not exist or has been permanently deleted.",
      action: (
        <Button asChild variant="outline" size="sm" className="shadow-subtle">
          <Link href="/admin/recruitment/candidates" className="flex items-center gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Back to Candidates
          </Link>
        </Button>
      ),
    },
    permission_denied: {
      icon: ShieldAlert,
      title: "Permission Denied",
      description:
        message ||
        "You do not have the required permissions to view or modify this candidate profile.",
      action: (
        <Button asChild variant="outline" size="sm" className="shadow-subtle">
          <Link href="/admin/recruitment/candidates" className="flex items-center gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Back to Candidates
          </Link>
        </Button>
      ),
    },
    disabled: {
      icon: Ban,
      title: "Recruitment Module Disabled",
      description:
        message ||
        "The recruitment module is currently disabled in system settings. Please contact your administrator.",
      action: (
        <Button asChild variant="outline" size="sm" className="shadow-subtle">
          <Link href="/admin" className="flex items-center gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
      ),
    },
    unexpected: {
      icon: AlertCircle,
      title: "Unexpected Error",
      description:
        message ||
        "An unexpected error occurred while processing your request. Please try again.",
      action: onRetry ? (
        <Button onClick={onRetry} size="sm" className="flex items-center gap-1.5 shadow-subtle">
          <RefreshCw className="h-4 w-4" />
          Retry Request
        </Button>
      ) : (
        <Button asChild variant="outline" size="sm" className="shadow-subtle">
          <Link href="/admin/recruitment/candidates" className="flex items-center gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Back to Candidates
          </Link>
        </Button>
      ),
    },
  }[type];

  const Icon = config.icon;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center p-8 sm:p-16 rounded-xl border border-border bg-card shadow-subtle max-w-lg mx-auto my-12 animate-in fade-in-50 slide-in-from-bottom-4 duration-300",
        className
      )}
    >
      <div
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full mb-4 shadow-subtle border",
          type === "permission_denied" || type === "disabled"
            ? "bg-rose-50/80 border-rose-200 text-rose-600 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-400"
            : "bg-amber-50/80 border-amber-200 text-amber-600 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-400"
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <h2 className="text-lg font-semibold text-foreground mb-2">{config.title}</h2>
      <p className="text-sm text-muted-foreground mb-6 leading-relaxed max-w-sm">
        {config.description}
      </p>
      {config.action}
    </div>
  );
}
