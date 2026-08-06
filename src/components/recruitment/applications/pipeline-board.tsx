"use client";

import React, { useCallback, useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RecruitmentPipelineStage } from "@/generated/prisma/enums";
import { CandidateAvatar } from "../candidates/candidate-avatar";
import { ErrorAlert } from "@/components/ui/error-alert";
import { moveApplicationStageAction } from "@/actions/recruitment-applications";
import {
  ApplicationPipelineDrawer,
  type PipelineDrawerApplication,
} from "./application-pipeline-drawer";
import { Clock } from "lucide-react";

interface BoardColumn {
  id: string;
  title: string;
  stages: RecruitmentPipelineStage[];
  defaultStage: RecruitmentPipelineStage;
  color: string;
}

/** Startup-first 5 columns — maps existing pipeline enums without schema changes. */
const COLUMNS: BoardColumn[] = [
  {
    id: "applied",
    title: "Applied",
    stages: [RecruitmentPipelineStage.resume_received],
    defaultStage: RecruitmentPipelineStage.resume_received,
    color: "border-t-blue-500",
  },
  {
    id: "screening",
    title: "Screening",
    stages: [
      RecruitmentPipelineStage.screening,
      RecruitmentPipelineStage.assessment,
      RecruitmentPipelineStage.hr_round,
    ],
    defaultStage: RecruitmentPipelineStage.screening,
    color: "border-t-amber-500",
  },
  {
    id: "interview",
    title: "Interview",
    stages: [
      RecruitmentPipelineStage.technical_round,
      RecruitmentPipelineStage.team_lead_round,
      RecruitmentPipelineStage.manager_round,
      RecruitmentPipelineStage.client_round,
    ],
    defaultStage: RecruitmentPipelineStage.technical_round,
    color: "border-t-indigo-500",
  },
  {
    id: "offer",
    title: "Offer",
    stages: [RecruitmentPipelineStage.offer, RecruitmentPipelineStage.decision],
    defaultStage: RecruitmentPipelineStage.offer,
    color: "border-t-pink-500",
  },
  {
    id: "joined",
    title: "Joined",
    stages: [RecruitmentPipelineStage.hired],
    defaultStage: RecruitmentPipelineStage.hired,
    color: "border-t-emerald-500",
  },
];

export function PipelineBoard({
  applications: initialApplications,
  employeeOptions,
  selectedApplication = null,
}: {
  applications: PipelineDrawerApplication[];
  employeeOptions: { id: number; name: string; user: { id: string; email: string } | null }[];
  selectedApplication?: PipelineDrawerApplication | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [applications, setApplications] = useState(initialApplications);
  const [error, setError] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  useEffect(() => {
    setApplications(initialApplications);
  }, [initialApplications]);

  const employeeMap = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const emp of employeeOptions) {
      if (emp.user?.id) map.set(emp.user.id, emp.name);
    }
    return map;
  }, [employeeOptions]);

  const selectedId = searchParams.get("applicationId");
  const drawerApp =
    selectedApplication ??
    applications.find((a) => a.id === selectedId) ??
    null;

  const setApplicationId = useCallback(
    (id: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (id) params.set("applicationId", id);
      else params.delete("applicationId");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, column: BoardColumn) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || draggedId;
    if (!id) return;

    const app = applications.find((a) => a.id === id);
    if (!app) return;
    if (column.stages.includes(app.currentStage as RecruitmentPipelineStage)) return;

    const targetStage = column.defaultStage;
    if (targetStage === RecruitmentPipelineStage.hired || column.id === "joined") {
      setError(
        "Joined is for converted hires only. Accept an offer, then use Convert to Employee."
      );
      setDraggedId(null);
      return;
    }

    const previousApplications = [...applications];
    setApplications((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              currentStage: targetStage,
            }
          : a
      )
    );
    setError(null);

    startTransition(async () => {
      const res = await moveApplicationStageAction({}, { id, stage: targetStage });
      if (res.error) {
        setError(res.error);
        setApplications(previousApplications);
      } else {
        router.refresh();
      }
    });

    setDraggedId(null);
  };

  return (
    <div className="space-y-4">
      {error && <ErrorAlert message={error} />}
      {isPending ? (
        <p className="text-xs font-medium text-muted-foreground">Updating pipeline…</p>
      ) : null}

      <div className="grid min-w-[1000px] grid-cols-1 gap-4 overflow-x-auto pb-4 md:grid-cols-5">
        {COLUMNS.map((col) => {
          const colApps = applications.filter((app) =>
            col.stages.includes(app.currentStage as RecruitmentPipelineStage)
          );

          return (
            <div
              key={col.id}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col)}
              className="flex min-h-[600px] w-full flex-col rounded-xl border border-border/60 bg-muted/35 p-3"
            >
              <div
                className={`flex items-center justify-between border-t-4 px-1 pb-3 pt-2 ${col.color}`}
              >
                <h4 className="text-sm font-bold tracking-tight text-foreground">{col.title}</h4>
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border/80 bg-muted text-[10px] font-bold tabular-nums text-muted-foreground">
                  {colApps.length}
                </span>
              </div>

              <div className="max-h-[550px] flex-1 space-y-3 overflow-y-auto pr-0.5">
                {colApps.map((app) => {
                  const recruiterName = (app as { assignedRecruiterUserId?: string | null })
                    .assignedRecruiterUserId
                    ? employeeMap.get(
                        (app as { assignedRecruiterUserId?: string }).assignedRecruiterUserId!
                      ) ?? "—"
                    : "—";

                  return (
                    <button
                      type="button"
                      key={app.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, app.id)}
                      onClick={() => setApplicationId(app.id)}
                      className="group relative w-full cursor-grab rounded-xl border border-border/80 bg-card p-3.5 text-left shadow-subtle transition-all duration-200 hover:border-primary/40 hover:shadow-elevated active:cursor-grabbing"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="line-clamp-1 text-sm font-bold leading-snug text-foreground group-hover:text-primary">
                          {app.candidate.fullName}
                        </span>
                        {app.priority === "high" || app.priority === "critical" ? (
                          <span className="inline-flex items-center rounded-full border border-red-100 bg-red-50 px-1.5 py-0.5 text-[9px] font-bold text-red-600 dark:border-red-500/20 dark:bg-red-500/10">
                            HIGH
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-1 line-clamp-1 text-xs font-semibold text-primary">
                        {app.jobOpening.title}
                      </p>

                      <div className="mt-3 flex items-center gap-1.5 border-t border-border/40 pt-3">
                        <CandidateAvatar fullName={app.candidate.fullName} className="h-5 w-5" />
                        <span className="max-w-[120px] truncate text-[10px] font-medium text-muted-foreground">
                          Recruiter: {recruiterName}
                        </span>
                      </div>

                      <div className="mt-2 flex items-center justify-between text-[10px] font-medium text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(app.createdAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                        <span className="rounded border border-border/40 bg-muted/60 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                          {String(app.currentStage).replace(/_/g, " ")}
                        </span>
                      </div>
                    </button>
                  );
                })}

                {colApps.length === 0 && (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/20 px-4 py-12 text-center">
                    <span className="text-xs font-medium text-muted-foreground">No candidates</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <ApplicationPipelineDrawer
        open={Boolean(selectedId)}
        application={drawerApp}
        onClose={() => setApplicationId(null)}
      />
    </div>
  );
}
