"use client";

import React from "react";
import Link from "next/link";
import { Clock, User, Briefcase, Calendar, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/** View-model fields used by the table; compatible with `InterviewDetail` from list queries. */
export type InterviewTableItem = {
  id: string;
  title: string | null;
  roundType: string;
  status: string;
  scheduledStart: string | Date | null;
  scheduledEnd: string | Date | null;
  application: {
    candidate: {
      fullName: string;
    } | null;
    jobOpening: {
      title: string;
    } | null;
  } | null;
  panelists: {
    employee: {
      name: string;
    };
  }[];
};

export function InterviewTable({
  interviews,
  detailHrefPrefix = "/admin/recruitment/interviews",
}: {
  interviews: InterviewTableItem[];
  detailHrefPrefix?: string;
}) {
  if (interviews.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 rounded-xl border border-dashed border-border bg-card text-center">
        <Calendar className="h-10 w-10 text-muted-foreground/60 mb-3" />
        <h3 className="text-sm font-bold text-foreground mb-1">No interviews found</h3>
        <p className="text-xs text-muted-foreground max-w-xs">
          Try adjusting your filters or schedule a new interview for an active application.
        </p>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 font-semibold text-xs py-0.5">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> Completed
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 gap-1 font-semibold text-xs py-0.5">
            <XCircle className="h-3.5 w-3.5 shrink-0" /> Cancelled
          </Badge>
        );
      case "no_show":
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1 font-semibold text-xs py-0.5">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> No Show
          </Badge>
        );
      case "scheduled":
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 gap-1 font-semibold text-xs py-0.5">
            <Clock className="h-3.5 w-3.5 shrink-0" /> Scheduled
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-muted text-muted-foreground border-border gap-1 font-semibold text-xs py-0.5">
            Draft
          </Badge>
        );
    }
  };

  return (
    <div className="border border-border rounded-xl overflow-hidden shadow-subtle bg-card">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-muted/30 border-b border-border text-xs font-bold text-muted-foreground uppercase tracking-wider">
            <tr>
              <th className="px-6 py-3">Candidate</th>
              <th className="px-6 py-3">Job Opening</th>
              <th className="px-6 py-3">Round</th>
              <th className="px-6 py-3">Scheduled</th>
              <th className="px-6 py-3">Panel</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {interviews.map((item) => {
              const candidateName = item.application?.candidate?.fullName ?? "Unknown";
              const jobTitle = item.application?.jobOpening?.title ?? "—";
              const scheduledAt = item.scheduledStart ? new Date(item.scheduledStart) : null;

              return (
              <tr key={item.id} className="hover:bg-muted/5 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs uppercase">
                      {candidateName.charAt(0)}
                    </div>
                    <div>
                      <div className="font-bold text-foreground">{candidateName}</div>
                      <div className="text-[11px] text-muted-foreground font-medium mt-0.5">{item.title}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
                    <Briefcase className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                    <span className="truncate max-w-[180px]">{jobTitle}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <Badge variant="secondary" className="font-bold text-xs capitalize">
                    {item.roundType.replace("_", " ")}
                  </Badge>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col text-xs font-medium text-muted-foreground">
                    <span className="font-bold text-foreground">
                      {scheduledAt
                        ? scheduledAt.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "—"}
                    </span>
                    <span className="mt-0.5">
                      {scheduledAt
                        ? scheduledAt.toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
                    <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                    <span>
                      {item.panelists.length > 0
                        ? item.panelists.map((p) => p.employee.name).join(", ")
                        : "No panelists assigned"}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">{getStatusBadge(item.status)}</td>
                <td className="px-6 py-4 text-right">
                  <Link href={`${detailHrefPrefix}/${item.id}`}>
                    <Button variant="outline" size="sm" className="font-semibold text-xs rounded-lg shadow-subtle">
                      View Details
                    </Button>
                  </Link>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
