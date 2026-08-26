"use client";

import React, { useCallback, useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RecruitmentPipelineStage } from "@/generated/prisma/enums";
import { CandidateAvatar } from "../candidates/candidate-avatar";
import { ErrorAlert } from "@/components/ui/error-alert";
import {
  moveApplicationStageAction,
  loadPipelineColumnAction,
} from "@/actions/recruitment-applications";
import {
  ApplicationPipelineDrawer,
  type PipelineDrawerApplication,
} from "./application-pipeline-drawer";
import { StageColumnMenu } from "./stage-column-menu";
import { AddPipelineStageDialog } from "./add-pipeline-stage-dialog";
import {
  CandidateCardDensityToggle,
  useCardDensity,
  type CardDensity,
} from "./candidate-card-density-toggle";
import { SYSTEM_STAGE_VALUES } from "@/lib/recruitment/shared/pipeline-stage-groups";
import { Clock, Loader2, Plus } from "lucide-react";

interface BoardColumn {
  id: string;
  title: string;
  stages: RecruitmentPipelineStage[];
  defaultStage: RecruitmentPipelineStage;
  color: string;
}

/** Startup-first 5 columns — cross-job fallback board when no single job is selected. */
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

export type PipelineDynamicColumn = {
  id: string;
  stage: RecruitmentPipelineStage;
  title: string;
  items: PipelineDrawerApplication[];
  total: number;
};

type EmployeeOption = { id: number; name: string; user: { id: string; email: string } | null };

const JOINED_STAGE_ERROR =
  "Joined is for converted hires only. Accept an offer, then use Convert to Employee.";

function useEmployeeMap(employeeOptions: EmployeeOption[]) {
  return React.useMemo(() => {
    const map = new Map<string, string>();
    for (const emp of employeeOptions) {
      if (emp.user?.id) map.set(emp.user.id, emp.name);
    }
    return map;
  }, [employeeOptions]);
}

function CandidateCard({
  app,
  employeeMap,
  density = "comfortable",
  onDragStart,
  onClick,
}: {
  app: PipelineDrawerApplication;
  employeeMap: Map<string, string>;
  density?: CardDensity;
  onDragStart: (e: React.DragEvent) => void;
  onClick: () => void;
}) {
  const recruiterName = (app as { assignedRecruiterUserId?: string | null }).assignedRecruiterUserId
    ? employeeMap.get((app as { assignedRecruiterUserId?: string }).assignedRecruiterUserId!) ?? "—"
    : "—";

  if (density === "compact") {
    const experience = app.candidate.totalExperienceYears;
    return (
      <button
        type="button"
        draggable
        onDragStart={onDragStart}
        onClick={onClick}
        className="group flex w-full cursor-grab flex-col gap-0.5 rounded-lg border border-border/80 bg-card px-3 py-2 text-left shadow-subtle transition-all duration-200 hover:border-primary/40 hover:shadow-elevated active:cursor-grabbing"
      >
        <span className="line-clamp-1 text-xs font-bold text-foreground group-hover:text-primary">
          {app.candidate.fullName}
          {experience != null ? (
            <span className="font-medium text-muted-foreground"> · {experience}y</span>
          ) : null}
          <span className="font-medium text-muted-foreground"> · {recruiterName}</span>
        </span>
        <span className="text-[10px] font-medium text-muted-foreground">
          {new Date(app.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })} ·{" "}
          {String(app.currentStage).replace(/_/g, " ").toUpperCase()}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
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

      <p className="mt-1 line-clamp-1 text-xs font-semibold text-primary">{app.jobOpening.title}</p>

      <div className="mt-3 flex items-center gap-1.5 border-t border-border/40 pt-3">
        <CandidateAvatar fullName={app.candidate.fullName} className="h-5 w-5" />
        <span className="max-w-[120px] truncate text-[10px] font-medium text-muted-foreground">
          Recruiter: {recruiterName}
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between text-[10px] font-medium text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {new Date(app.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </span>
        <span className="rounded border border-border/40 bg-muted/60 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider">
          {String(app.currentStage).replace(/_/g, " ")}
        </span>
      </div>
    </button>
  );
}

export function PipelineBoard({
  mode = "static",
  applications: initialApplications = [],
  dynamicColumns: initialDynamicColumns,
  jobOpeningId,
  employeeOptions,
  selectedApplication = null,
}: {
  mode?: "static" | "dynamic";
  applications?: PipelineDrawerApplication[];
  dynamicColumns?: PipelineDynamicColumn[];
  jobOpeningId?: string;
  employeeOptions: EmployeeOption[];
  selectedApplication?: PipelineDrawerApplication | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const employeeMap = useEmployeeMap(employeeOptions);
  const [density, setDensity] = useCardDensity();

  const selectedId = searchParams.get("applicationId");

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

  if (mode === "dynamic" && jobOpeningId) {
    return (
      <DynamicBoard
        jobOpeningId={jobOpeningId}
        initialColumns={initialDynamicColumns ?? []}
        employeeMap={employeeMap}
        density={density}
        onDensityChange={setDensity}
        selectedId={selectedId}
        selectedApplication={selectedApplication}
        setApplicationId={setApplicationId}
      />
    );
  }

  return (
    <StaticBoard
      initialApplications={initialApplications}
      employeeMap={employeeMap}
      density={density}
      onDensityChange={setDensity}
      selectedId={selectedId}
      selectedApplication={selectedApplication}
      setApplicationId={setApplicationId}
    />
  );
}

function StaticBoard({
  initialApplications,
  employeeMap,
  density,
  onDensityChange,
  selectedId,
  selectedApplication,
  setApplicationId,
}: {
  initialApplications: PipelineDrawerApplication[];
  employeeMap: Map<string, string>;
  density: CardDensity;
  onDensityChange: (density: CardDensity) => void;
  selectedId: string | null;
  selectedApplication: PipelineDrawerApplication | null;
  setApplicationId: (id: string | null) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [applications, setApplications] = useState(initialApplications);

  useEffect(() => {
    setApplications(initialApplications);
  }, [initialApplications]);

  const drawerApp = selectedApplication ?? applications.find((a) => a.id === selectedId) ?? null;

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
      setError(JOINED_STAGE_ERROR);
      setDraggedId(null);
      return;
    }

    const previousApplications = [...applications];
    setApplications((prev) =>
      prev.map((a) => (a.id === id ? { ...a, currentStage: targetStage } : a))
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
      <div className="flex items-center justify-end">
        <CandidateCardDensityToggle density={density} onChange={onDensityChange} />
      </div>
      {error && <ErrorAlert message={error} />}
      {isPending ? (
        <p className="text-xs font-medium text-muted-foreground">Updating pipeline…</p>
      ) : null}

      <div className="w-full min-w-0 max-w-full overflow-x-auto pb-4">
        <div className="flex min-w-max gap-4">
        {COLUMNS.map((col) => {
          const colApps = applications.filter((app) =>
            col.stages.includes(app.currentStage as RecruitmentPipelineStage)
          );

          return (
            <div
              key={col.id}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col)}
              className="flex min-h-[600px] w-[300px] shrink-0 flex-col rounded-xl border border-border/60 bg-muted/35 p-3"
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
                {colApps.map((app) => (
                  <CandidateCard
                    key={app.id}
                    app={app}
                    employeeMap={employeeMap}
                    density={density}
                    onDragStart={(e) => handleDragStart(e, app.id)}
                    onClick={() => setApplicationId(app.id)}
                  />
                ))}

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
      </div>

      <ApplicationPipelineDrawer
        open={Boolean(selectedId)}
        application={drawerApp}
        onClose={() => setApplicationId(null)}
      />
    </div>
  );
}

/**
 * Job-scoped board: one column per JobOpeningStage, counts/initial items
 * fetched server-side (pipeline/page.tsx), further items fetched per-column
 * via loadPipelineColumnAction instead of a single global item cap.
 */
function DynamicBoard({
  jobOpeningId,
  initialColumns,
  employeeMap,
  density,
  onDensityChange,
  selectedId,
  selectedApplication,
  setApplicationId,
}: {
  jobOpeningId: string;
  initialColumns: PipelineDynamicColumn[];
  employeeMap: Map<string, string>;
  density: CardDensity;
  onDensityChange: (density: CardDensity) => void;
  selectedId: string | null;
  selectedApplication: PipelineDrawerApplication | null;
  setApplicationId: (id: string | null) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loadingColumnId, setLoadingColumnId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [columns, setColumns] = useState(initialColumns);
  const [pageByColumn, setPageByColumn] = useState<Record<string, number>>({});
  const [addStageAt, setAddStageAt] = useState<{
    afterStageId?: string | null;
    beforeStageId?: string | null;
  } | null>(null);

  useEffect(() => {
    setColumns(initialColumns);
    setPageByColumn({});
  }, [initialColumns]);

  const allItems = columns.flatMap((c) => c.items);
  const drawerApp = selectedApplication ?? allItems.find((a) => a.id === selectedId) ?? null;

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, target: PipelineDynamicColumn) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || draggedId;
    setDraggedId(null);
    if (!id) return;

    const sourceIndex = columns.findIndex((c) => c.items.some((a) => a.id === id));
    if (sourceIndex === -1) return;
    const source = columns[sourceIndex];
    if (source.id === target.id) return;

    if (target.stage === RecruitmentPipelineStage.hired) {
      setError(JOINED_STAGE_ERROR);
      return;
    }

    const app = source.items.find((a) => a.id === id);
    if (!app) return;

    const previousColumns = columns;
    setColumns((prev) =>
      prev.map((c) => {
        if (c.id === source.id) {
          return { ...c, items: c.items.filter((a) => a.id !== id), total: c.total - 1 };
        }
        if (c.id === target.id) {
          return {
            ...c,
            items: [{ ...app, currentStage: target.stage }, ...c.items],
            total: c.total + 1,
          };
        }
        return c;
      })
    );
    setError(null);

    startTransition(async () => {
      const res = await moveApplicationStageAction({}, { id, stage: target.stage });
      if (res.error) {
        setError(res.error);
        setColumns(previousColumns);
      } else {
        router.refresh();
      }
    });
  };

  const handleLoadMore = (column: PipelineDynamicColumn) => {
    const nextPage = (pageByColumn[column.id] ?? 1) + 1;
    setLoadingColumnId(column.id);
    startTransition(async () => {
      const res = await loadPipelineColumnAction({
        jobOpeningId,
        stage: column.stage,
        page: nextPage,
      });
      setLoadingColumnId(null);
      if (res.error) {
        setError(res.error);
        return;
      }
      setPageByColumn((prev) => ({ ...prev, [column.id]: nextPage }));
      setColumns((prev) =>
        prev.map((c) =>
          c.id === column.id
            ? { ...c, items: [...c.items, ...(res.items as unknown as PipelineDrawerApplication[])], total: res.total }
            : c
        )
      );
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <CandidateCardDensityToggle density={density} onChange={onDensityChange} />
      </div>
      {error && <ErrorAlert message={error} />}
      {isPending && !loadingColumnId ? (
        <p className="text-xs font-medium text-muted-foreground">Updating pipeline…</p>
      ) : null}

      <div className="w-full min-w-0 max-w-full overflow-x-auto pb-4">
        <div className="flex min-w-max items-stretch">
        <AddStageGap onClick={() => setAddStageAt({ beforeStageId: columns[0]?.id ?? null })} />
        {columns.map((col, index) => {
          const isSystemStage = SYSTEM_STAGE_VALUES.has(col.stage);
          return (
            <div key={col.id} className="flex items-stretch">
              <div
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, col)}
                className="flex min-h-[600px] w-[300px] shrink-0 flex-col rounded-xl border border-border/60 bg-muted/35 p-3"
              >
                <div className="flex items-center justify-between gap-1.5 border-t-4 border-t-primary/60 px-1 pb-3 pt-2">
                  <h4 className="line-clamp-1 flex-1 text-sm font-bold tracking-tight text-foreground">
                    {col.title}
                  </h4>
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-border/80 bg-muted px-1 text-[10px] font-bold tabular-nums text-muted-foreground">
                    {col.total}
                  </span>
                  <StageColumnMenu
                    stage={{
                      id: col.id,
                      label: col.title,
                      isSystemStage,
                      canMoveLeft: index > 0,
                      canMoveRight: index < columns.length - 1,
                    }}
                    onAddBefore={() =>
                      setAddStageAt({ beforeStageId: col.id, afterStageId: columns[index - 1]?.id ?? null })
                    }
                    onAddAfter={() =>
                      setAddStageAt({ afterStageId: col.id, beforeStageId: columns[index + 1]?.id ?? null })
                    }
                    onChanged={() => router.refresh()}
                  />
                </div>

                <div className="max-h-[550px] flex-1 space-y-3 overflow-y-auto pr-0.5">
                  {col.items.map((app) => (
                    <CandidateCard
                      key={app.id}
                      app={app}
                      employeeMap={employeeMap}
                      density={density}
                      onDragStart={(e) => handleDragStart(e, app.id)}
                      onClick={() => setApplicationId(app.id)}
                    />
                  ))}

                  {col.items.length === 0 && (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/20 px-4 py-12 text-center">
                      <span className="text-xs font-medium text-muted-foreground">No candidates</span>
                    </div>
                  )}

                  {col.items.length < col.total ? (
                    <button
                      type="button"
                      onClick={() => handleLoadMore(col)}
                      disabled={isPending}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/60 py-2 text-xs font-semibold text-muted-foreground hover:border-primary/40 hover:text-primary disabled:opacity-60"
                    >
                      {loadingColumnId === col.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      Load more ({col.total - col.items.length} remaining)
                    </button>
                  ) : null}
                </div>
              </div>

              <AddStageGap onClick={() => setAddStageAt({ afterStageId: col.id, beforeStageId: columns[index + 1]?.id ?? null })} />
            </div>
          );
        })}
        </div>
      </div>

      <ApplicationPipelineDrawer
        open={Boolean(selectedId)}
        application={drawerApp}
        onClose={() => setApplicationId(null)}
      />

      <AddPipelineStageDialog
        open={Boolean(addStageAt)}
        onOpenChange={(open) => {
          if (!open) setAddStageAt(null);
        }}
        jobOpeningId={jobOpeningId}
        afterStageId={addStageAt?.afterStageId}
        beforeStageId={addStageAt?.beforeStageId}
        onCreated={() => router.refresh()}
      />
    </div>
  );
}

/** Hover slot between two dynamic-board columns exposing a "+ Add stage" affordance. */
function AddStageGap({ onClick }: { onClick: () => void }) {
  return (
    <div className="group relative flex w-3 shrink-0 items-stretch justify-center">
      <div className="w-px bg-transparent transition-colors group-hover:bg-primary/30" />
      <button
        type="button"
        onClick={onClick}
        title="Add stage here"
        className="absolute top-1/2 z-10 hidden h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-subtle transition hover:border-primary/50 hover:text-primary group-hover:flex"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
