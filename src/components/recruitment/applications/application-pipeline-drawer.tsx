"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { OfferStatus, RecruitmentPipelineStage } from "@/generated/prisma/enums";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/error-alert";
import { moveApplicationStageAction } from "@/actions/recruitment-applications";
import { CandidateAvatar } from "@/components/recruitment/candidates/candidate-avatar";
import { ApplicationAssessmentForm } from "@/components/recruitment/applications/application-assessment-form";
import { Clock, ExternalLink } from "lucide-react";

const STAGE_OPTIONS: RecruitmentPipelineStage[] = [
  RecruitmentPipelineStage.resume_received,
  RecruitmentPipelineStage.screening,
  RecruitmentPipelineStage.assessment,
  RecruitmentPipelineStage.hr_round,
  RecruitmentPipelineStage.technical_round,
  RecruitmentPipelineStage.team_lead_round,
  RecruitmentPipelineStage.manager_round,
  RecruitmentPipelineStage.client_round,
  RecruitmentPipelineStage.offer,
  RecruitmentPipelineStage.decision,
  RecruitmentPipelineStage.hired,
];

export type PipelineDrawerApplication = {
  id: string;
  currentStage: RecruitmentPipelineStage | string;
  status: string;
  priority?: string | null;
  createdAt: Date | string;
  candidate: {
    id: string;
    fullName: string;
    email?: string | null;
    phone?: string | null;
  };
  jobOpening: {
    id: string;
    title: string;
  };
  interviews?: Array<{
    id: string;
    title: string;
    scheduledStart: Date | string;
    status: string;
  }>;
  offers?: Array<{
    id: string;
    offerNumber?: string | null;
    status: string;
    ctc?: number | string | null;
  }>;
  stageHistory?: Array<{
    id: string;
    toStage?: string | null;
    fromStage?: string | null;
    createdAt: Date | string;
  }>;
  assessment?: string | null;
  assessmentUpdatedAt?: Date | string | null;
  assessmentUpdatedByEmail?: string | null;
};

export function ApplicationPipelineDrawer({
  application,
  open,
  onClose,
}: {
  application: PipelineDrawerApplication | null;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  if (!application) {
    return (
      <Sheet open={open} onClose={onClose} title="Application" description="Not found or out of scope.">
        <p className="text-sm text-muted-foreground">This application could not be loaded.</p>
        <Button className="mt-4" variant="outline" onClick={onClose}>
          Close
        </Button>
      </Sheet>
    );
  }

  const acceptedOffer = application.offers?.find((o) => o.status === OfferStatus.accepted);

  const moveStage = (stage: RecruitmentPipelineStage) => {
    setError(null);
    startTransition(async () => {
      const res = await moveApplicationStageAction({}, { id: application.id, stage });
      if (res.error) setError(res.error);
      else router.refresh();
    });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={application.candidate.fullName}
      description={`${application.jobOpening.title} · ${String(application.currentStage).replace(/_/g, " ")}`}
    >
      <div className="space-y-6">
        {error && <ErrorAlert message={error} />}

        <section className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Candidate</h3>
          <div className="flex items-center gap-3">
            <CandidateAvatar fullName={application.candidate.fullName} className="h-10 w-10" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{application.candidate.fullName}</p>
              <p className="truncate text-xs text-muted-foreground">{application.candidate.email ?? "—"}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm" className="text-xs font-semibold">
              <Link href={`/admin/recruitment/candidates/${application.candidate.id}`}>
                Candidate workspace
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="text-xs font-semibold">
              <Link href={`/admin/recruitment/applications/${application.id}`}>
                Full application
                <ExternalLink className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Quick actions</h3>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" className="text-xs font-semibold">
              <Link href={`/admin/recruitment/interviews/new?applicationId=${application.id}`}>
                Schedule interview
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="text-xs font-semibold">
              <Link href={`/admin/recruitment/offers/new?applicationId=${application.id}`}>
                Create offer
              </Link>
            </Button>
            {acceptedOffer ? (
              <Button asChild variant="outline" size="sm" className="text-xs font-semibold">
                <Link href={`/admin/recruitment/conversions/${acceptedOffer.id}`}>Convert to employee</Link>
              </Button>
            ) : null}
            <Button
              asChild
              variant="outline"
              size="sm"
              className="text-xs font-semibold"
            >
              <Link
                href={`/admin/recruitment/communications/new?candidateId=${encodeURIComponent(application.candidate.id)}${
                  application.candidate.email
                    ? `&recipientEmail=${encodeURIComponent(application.candidate.email)}`
                    : ""
                }`}
              >
                Message
              </Link>
            </Button>
          </div>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Move stage</span>
            <select
              className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
              disabled={isPending}
              value={String(application.currentStage)}
              onChange={(e) => moveStage(e.target.value as RecruitmentPipelineStage)}
            >
              {STAGE_OPTIONS.map((stage) => (
                <option key={stage} value={stage}>
                  {stage.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>
        </section>

        <ApplicationAssessmentForm
          applicationId={application.id}
          assessment={application.assessment}
          assessmentUpdatedAt={application.assessmentUpdatedAt}
          assessmentUpdatedByEmail={application.assessmentUpdatedByEmail}
          compact
        />

        <section className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Interview</h3>
          {(application.interviews?.length ?? 0) === 0 ? (
            <p className="text-xs text-muted-foreground">No interviews scheduled.</p>
          ) : (
            <ul className="space-y-2">
              {application.interviews!.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2"
                >
                  <div>
                    <p className="text-xs font-semibold">{item.title}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {new Date(item.scheduledStart).toLocaleString()}
                    </p>
                  </div>
                  <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                    <Link href={`/admin/recruitment/interviews/${item.id}`}>Open</Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Offer</h3>
          {(application.offers?.length ?? 0) === 0 ? (
            <p className="text-xs text-muted-foreground">No offers yet.</p>
          ) : (
            <ul className="space-y-2">
              {application.offers!.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2"
                >
                  <div>
                    <p className="text-xs font-semibold">{item.offerNumber || "Draft offer"}</p>
                    <p className="text-[11px] text-muted-foreground">{item.status}</p>
                  </div>
                  <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                    <Link href={`/admin/recruitment/offers/${item.id}`}>Open</Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Activity</h3>
          {(application.stageHistory?.length ?? 0) === 0 ? (
            <p className="text-xs text-muted-foreground">No stage history yet.</p>
          ) : (
            <ul className="space-y-2">
              {application.stageHistory!.slice(0, 8).map((item) => (
                <li key={item.id} className="border-l-2 border-border pl-3">
                  <p className="text-xs font-medium">
                    {(item.fromStage ?? "—").replace(/_/g, " ")} →{" "}
                    {(item.toStage ?? "—").replace(/_/g, " ")}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Sheet>
  );
}
