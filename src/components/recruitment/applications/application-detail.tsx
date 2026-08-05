"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApplicationStatus, RecruitmentPipelineStage } from "@/generated/prisma/enums";
import { CandidateAvatar } from "../candidates/candidate-avatar";
import { CandidateSection } from "../candidates/candidate-section";
import { CandidateInfoItem } from "../candidates/candidate-info-item";
import { CandidateMetaRow } from "../candidates/candidate-meta-row";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/error-alert";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApplicationAssessmentForm } from "@/components/recruitment/applications/application-assessment-form";
import {
  moveApplicationStageAction,
  rejectApplicationAction,
  withdrawApplicationAction,
  reopenApplicationAction,
  hireCandidateAction,
} from "@/actions/recruitment-applications";
import {
  User,
  Mail,
  Phone,
  Briefcase,
  Globe,
  MapPin,
  Clock,
  ArrowRight,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronRight,
  FileText,
} from "lucide-react";

function formatDate(value: Date | string | null): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ApplicationDetailView({
  application,
  employeeOptions,
  interviews = [],
  offers = [],
}: {
  application: any;
  employeeOptions: { id: number; name: string; user: { id: string; email: string } | null }[];
  interviews?: any[];
  offers?: any[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Dialog States
  const [rejectReason, setRejectReason] = useState("");
  const [withdrawReason, setWithdrawReason] = useState("");

  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    actionLabel?: string;
    onAction: () => void;
    isDestructive?: boolean;
    children?: React.ReactNode;
  } | null>(null);

  const employeeMap = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const emp of employeeOptions) {
      if (emp.user?.id) {
        map.set(emp.user.id, emp.name);
      }
    }
    return map;
  }, [employeeOptions]);

  const recruiterName = application.assignedRecruiterUserId
    ? employeeMap.get(application.assignedRecruiterUserId) ?? "—"
    : "—";

  const handleMoveStage = (targetStage: RecruitmentPipelineStage) => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await moveApplicationStageAction({}, { id: application.id, stage: targetStage });
      if (res.error) {
        setError(res.error);
      } else {
        setSuccess("Application stage updated successfully.");
        router.refresh();
      }
    });
  };

  const handleReject = () => {
    if (!rejectReason.trim()) return;
    setAlertConfig(null);
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await rejectApplicationAction({}, { id: application.id, reason: rejectReason.trim() });
      if (res.error) {
        setError(res.error);
      } else {
        setSuccess("Application rejected.");
        setRejectReason("");
        router.refresh();
      }
    });
  };

  const handleWithdraw = () => {
    if (!withdrawReason.trim()) return;
    setAlertConfig(null);
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await withdrawApplicationAction({}, { id: application.id, reason: withdrawReason.trim() });
      if (res.error) {
        setError(res.error);
      } else {
        setSuccess("Application withdrawn.");
        setWithdrawReason("");
        router.refresh();
      }
    });
  };

  const handleReopen = () => {
    setAlertConfig({
      isOpen: true,
      title: "Reopen Application",
      description: "Are you sure you want to reopen this application? This will return the candidate to the active pipeline.",
      actionLabel: "Reopen Application",
      onAction: () => {
        setError(null);
        setSuccess(null);
        startTransition(async () => {
          const res = await reopenApplicationAction({}, { id: application.id });
          if (res.error) {
            setError(res.error);
          } else {
            setSuccess("Application reopened successfully.");
            router.refresh();
          }
        });
      },
    });
  };

  const handleHire = () => {
    setAlertConfig({
      isOpen: true,
      title: "Hire Candidate",
      description: "Are you sure you want to hire this candidate? This will set the application status to HIRED and candidate status to HIRED.",
      actionLabel: "Hire Candidate",
      onAction: () => {
        setError(null);
        setSuccess(null);
        startTransition(async () => {
          const res = await hireCandidateAction({}, { id: application.id });
          if (res.error) {
            setError(res.error);
          } else {
            setSuccess("Candidate hired successfully!");
            router.refresh();
          }
        });
      },
    });
  };

  return (
    <div className="space-y-6">
      {error && <ErrorAlert message={error} />}
      {success && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/30 dark:bg-emerald-500/10 dark:text-emerald-400">
          {success}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content (Left) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Candidate Overview */}
          <CandidateSection title="Candidate Details" description="Information about the applicant.">
            <div className="flex items-center gap-4 pb-4 border-b border-border/40">
              <CandidateAvatar fullName={application.candidate.fullName} className="h-12 w-12" />
              <div>
                <h3 className="text-base font-bold text-foreground">{application.candidate.fullName}</h3>
                <span className="text-xs text-muted-foreground">{application.candidate.email}</span>
              </div>
            </div>
            <dl className="grid gap-4 sm:grid-cols-2 mt-4">
              <CandidateInfoItem label="Email" value={application.candidate.email} icon={Mail} />
              <CandidateInfoItem label="Phone" value={application.candidate.phone} icon={Phone} />
              <CandidateInfoItem label="Location" value={application.candidate.location} icon={MapPin} />
              <CandidateInfoItem label="Source" value={application.source ?? "—"} icon={Globe} />
            </dl>
          </CandidateSection>

          {/* Job Opening Details */}
          <CandidateSection title="Job Opening" description="The position this application is linked to.">
            <dl className="grid gap-4 sm:grid-cols-2">
              <CandidateInfoItem label="Job Title" value={application.jobOpening.title} icon={Briefcase} />
              <CandidateInfoItem label="Department" value={application.jobOpening.department} icon={Briefcase} />
              <CandidateInfoItem label="Location" value={application.jobOpening.location} icon={MapPin} />
              <CandidateInfoItem label="Work Mode" value={application.jobOpening.workMode} icon={Globe} />
            </dl>
          </CandidateSection>

          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-subtle sm:p-5">
            <ApplicationAssessmentForm
              applicationId={application.id}
              assessment={application.assessment ?? null}
              assessmentUpdatedAt={application.assessmentUpdatedAt ?? null}
              assessmentUpdatedByEmail={application.assessmentUpdatedBy?.email ?? null}
            />
          </div>

          {/* Interviews Section */}
          <CandidateSection
            title="Interviews"
            description="Upcoming and completed interviews for this application."
            action={
              <Button asChild size="sm" className="font-semibold text-xs rounded-lg shadow-subtle">
                <Link href={`/admin/recruitment/interviews/new?applicationId=${application.id}`}>
                  Schedule Interview
                </Link>
              </Button>
            }
          >
            {interviews.length === 0 ? (
              <div className="text-center py-6 text-xs text-muted-foreground">
                No interviews scheduled yet.
              </div>
            ) : (
              <div className="space-y-3">
                {interviews.map((item: any) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3.5 rounded-xl border border-border/60 bg-card hover:shadow-subtle transition-shadow duration-150"
                  >
                    <div>
                      <h4 className="font-bold text-foreground text-xs">{item.title}</h4>
                      <p className="text-[11px] text-muted-foreground font-medium mt-1 flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(item.scheduledStart).toLocaleDateString()} at{" "}
                        {new Date(item.scheduledStart).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold capitalize text-primary bg-primary/5 border border-primary/10 px-2 py-0.5 rounded-md">
                        {item.status}
                      </span>
                      <Button asChild variant="outline" size="sm" className="font-semibold text-xs rounded-lg">
                        <Link href={`/admin/recruitment/interviews/${item.id}`}>View</Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CandidateSection>

          {/* Offers Section */}
          <CandidateSection
            title="Offers"
            description="Manage and track compensation offers for this candidate."
            action={
              <Button asChild size="sm" className="font-semibold text-xs rounded-lg shadow-subtle">
                <Link href={`/admin/recruitment/offers/new?applicationId=${application.id}`}>
                  Create Offer
                </Link>
              </Button>
            }
          >
            {offers.length === 0 ? (
              <div className="text-center py-6 text-xs text-muted-foreground">
                No offers created yet.
              </div>
            ) : (
              <div className="space-y-3">
                {offers.map((item: any) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3.5 rounded-xl border border-border/60 bg-card hover:shadow-subtle transition-shadow duration-150"
                  >
                    <div>
                      <h4 className="font-bold text-foreground text-xs">
                        {item.offerNumber || "Draft Offer"}
                      </h4>
                      <p className="text-[11px] text-muted-foreground font-medium mt-1">
                        CTC: {Number(item.ctc).toLocaleString()} {item.currency} · Joining:{" "}
                        {item.joiningDate ? new Date(item.joiningDate).toLocaleDateString() : "N/A"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold capitalize text-primary bg-primary/5 border border-primary/10 px-2 py-0.5 rounded-md">
                        {item.status}
                      </span>
                      <Button asChild variant="outline" size="sm" className="font-semibold text-xs rounded-lg">
                        <Link href={`/admin/recruitment/offers/${item.id}`}>View</Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CandidateSection>

          {/* Pipeline Stage History */}
          <CandidateSection title="Hiring Pipeline Progress" description="History of stage transitions for this application.">
            {application.stageHistory.length === 0 ? (
              <div className="text-center py-6 text-xs text-muted-foreground">No stage history recorded.</div>
            ) : (
              <div className="space-y-4">
                {application.stageHistory.map((h: any, i: number) => (
                  <div key={h.id} className="relative border-l-2 border-border/80 pl-5 ml-2.5 animate-in fade-in-50 duration-200">
                    <div className="absolute -left-[6px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background" />
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h4 className="font-bold text-foreground text-sm">
                          {h.fromStage ? `${h.fromStage.replace(/_/g, " ").toUpperCase()} → ` : ""}
                          <span className="text-primary">{h.toStage.replace(/_/g, " ").toUpperCase()}</span>
                        </h4>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1 font-medium">
                          <Clock className="h-3.5 w-3.5" />
                          {formatDate(h.createdAt)}
                          {h.actor ? ` · Updated by ${h.actor.email}` : ""}
                        </p>
                        {h.note && (
                          <p className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed bg-muted/10 p-2.5 rounded-lg border border-border/20">
                            {h.note}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CandidateSection>
        </div>

        {/* Sidebar Panel (Right) */}
        <div className="space-y-6">
          {/* Pipeline & Status Control */}
          <CandidateSection title="Lifecycle & Stage" description="Current pipeline categorization.">
            <div className="space-y-4">
              <div>
                <Label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Current Status
                </Label>
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold border ${
                    application.status === ApplicationStatus.active
                      ? "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-500/10 dark:border-blue-500/20 dark:text-blue-400"
                      : application.status === ApplicationStatus.hired
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400"
                      : application.status === ApplicationStatus.rejected
                      ? "bg-red-50 border-red-200 text-red-700 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400"
                      : "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-400"
                  }`}
                >
                  {application.status.replace(/_/g, " ").toUpperCase()}
                </span>
              </div>

              <div>
                <Label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Current Stage
                </Label>
                <span className="inline-flex items-center rounded-full bg-primary/5 border border-primary/10 px-3 py-1 text-xs font-bold text-primary">
                  {application.currentStage.replace(/_/g, " ").toUpperCase()}
                </span>
              </div>

              {/* Recruiter & Manager Info */}
              <div className="pt-4 border-t border-border/40 space-y-3">
                <CandidateMetaRow label="Assigned Recruiter" value={recruiterName} />
                <CandidateMetaRow
                  label="Assigned Manager"
                  value={application.assignedManager?.name ?? "—"}
                />
                <CandidateMetaRow label="Priority" value={application.priority.toUpperCase()} />
              </div>

              {/* Stage Transition Controls */}
              {application.status === ApplicationStatus.active || application.status === ApplicationStatus.on_hold ? (
                <div className="pt-4 border-t border-border/40 space-y-3">
                  <Label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Move to Next Stage
                  </Label>
                  <div className="grid grid-cols-1 gap-2">
                    {Object.values(RecruitmentPipelineStage)
                      .filter(
                        (stage) =>
                          stage !== application.currentStage &&
                          ![
                            RecruitmentPipelineStage.rejected,
                            RecruitmentPipelineStage.withdrawn,
                            RecruitmentPipelineStage.hired,
                            RecruitmentPipelineStage.on_hold,
                          ].includes(stage)
                      )
                      .slice(0, 3) // Show next few logical stages
                      .map((stage) => (
                        <Button
                          key={stage}
                          variant="outline"
                          size="sm"
                          onClick={() => handleMoveStage(stage)}
                          disabled={isPending}
                          className="w-full justify-between font-semibold text-xs"
                        >
                          <span>Move to {stage.replace(/_/g, " ").toUpperCase()}</span>
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      ))}
                  </div>

                  <div className="flex flex-col gap-2 pt-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleHire}
                      disabled={isPending}
                      className="w-full font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      Hire Candidate
                    </Button>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setAlertConfig({
                            isOpen: true,
                            title: "Reject Application",
                            description: "Please provide a reason for rejecting this application.",
                            actionLabel: "Reject",
                            isDestructive: true,
                            onAction: handleReject,
                            children: (
                              <div className="space-y-2 mt-3">
                                <Label htmlFor="reject-reason">Rejection Reason</Label>
                                <Input
                                  id="reject-reason"
                                  value={rejectReason}
                                  onChange={(e) => setRejectReason(e.target.value)}
                                  placeholder="e.g. Failed technical round"
                                />
                              </div>
                            ),
                          })
                        }
                        disabled={isPending}
                        className="font-semibold text-xs text-red-600 hover:bg-red-50/50 hover:text-red-700"
                      >
                        Reject
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setAlertConfig({
                            isOpen: true,
                            title: "Withdraw Application",
                            description: "Please provide a reason for withdrawing this application.",
                            actionLabel: "Withdraw",
                            onAction: handleWithdraw,
                            children: (
                              <div className="space-y-2 mt-3">
                                <Label htmlFor="withdraw-reason">Withdrawal Reason</Label>
                                <Input
                                  id="withdraw-reason"
                                  value={withdrawReason}
                                  onChange={(e) => setWithdrawReason(e.target.value)}
                                  placeholder="e.g. Accepted another offer"
                                />
                              </div>
                            ),
                          })
                        }
                        disabled={isPending}
                        className="font-semibold text-xs text-amber-600 hover:bg-amber-50/50 hover:text-amber-700"
                      >
                        Withdraw
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="pt-4 border-t border-border/40 space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReopen}
                    disabled={isPending}
                    className="w-full font-bold"
                  >
                    Reopen Application
                  </Button>
                </div>
              )}
            </div>
          </CandidateSection>
        </div>
      </div>

      {alertConfig && (
        <AlertDialog
          isOpen={alertConfig.isOpen}
          onOpenChange={(open) => setAlertConfig(open ? alertConfig : null)}
          title={alertConfig.title}
          description={alertConfig.description}
          actionLabel={alertConfig.actionLabel}
          isActionDestructive={alertConfig.isDestructive}
          isPending={isPending}
          onAction={alertConfig.onAction}
        >
          {alertConfig.children}
        </AlertDialog>
      )}
    </div>
  );
}
