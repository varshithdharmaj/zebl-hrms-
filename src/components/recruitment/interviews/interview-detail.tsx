"use client";

import React, { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  cancelInterviewAction,
  completeInterviewAction,
} from "@/actions/recruitment-interviews";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Clock,
  MapPin,
  Video,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  Plus,
  Pencil,
  Mail,
} from "lucide-react";
import { FeedbackForm } from "./feedback-form";

interface InterviewDetailViewProps {
  interview: any;
  currentUserId: string;
  canManage: boolean;
  backHref?: string;
}

export function InterviewDetailView({
  interview,
  currentUserId,
  canManage,
  backHref = "/admin/recruitment/interviews",
}: InterviewDetailViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [showFeedbackForm, setShowFeedbackForm] = React.useState(false);

  const handleCancel = () => {
    if (!confirm("Are you sure you want to cancel this interview?")) return;
    setError(null);
    startTransition(async () => {
      const res = await cancelInterviewAction(
        {},
        { id: interview.id, applicationId: interview.applicationId }
      );
      if (res.error) {
        setError(res.error);
      } else {
        router.refresh();
      }
    });
  };

  const handleComplete = () => {
    if (!confirm("Are you sure you want to mark this interview as completed?")) return;
    setError(null);
    startTransition(async () => {
      const res = await completeInterviewAction(
        {},
        { id: interview.id, applicationId: interview.applicationId }
      );
      if (res.error) {
        setError(res.error);
      } else {
        router.refresh();
      }
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge
            variant="outline"
            className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 font-semibold text-xs py-0.5"
          >
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> Completed
          </Badge>
        );
      case "cancelled":
        return (
          <Badge
            variant="outline"
            className="bg-red-50 text-red-700 border-red-200 gap-1 font-semibold text-xs py-0.5"
          >
            <XCircle className="h-3.5 w-3.5 shrink-0" /> Cancelled
          </Badge>
        );
      case "no_show":
        return (
          <Badge
            variant="outline"
            className="bg-amber-50 text-amber-700 border-amber-200 gap-1 font-semibold text-xs py-0.5"
          >
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> No Show
          </Badge>
        );
      case "scheduled":
        return (
          <Badge
            variant="outline"
            className="bg-blue-50 text-blue-700 border-blue-200 gap-1 font-semibold text-xs py-0.5"
          >
            <Clock className="h-3.5 w-3.5 shrink-0" /> Scheduled
          </Badge>
        );
      default:
        return (
          <Badge
            variant="outline"
            className="bg-muted text-muted-foreground border-border gap-1 font-semibold text-xs py-0.5"
          >
            Draft
          </Badge>
        );
    }
  };

  const isAssignedPanelist = interview.panelists.some(
    (p: { employee?: { user?: { id?: string } } }) =>
      p.employee?.user?.id === currentUserId
  );
  const canSubmitFeedback =
    interview.status !== "cancelled" && (canManage || isAssignedPanelist);

  const candidateId =
    typeof interview.application?.candidateId === "string"
      ? interview.application.candidateId
      : typeof interview.application?.candidate?.id === "string"
        ? interview.application.candidate.id
        : "";

  const invitationHref = `/admin/recruitment/communications/new?interviewId=${encodeURIComponent(
    interview.id
  )}&applicationId=${encodeURIComponent(interview.applicationId)}${
    candidateId ? `&candidateId=${encodeURIComponent(candidateId)}` : ""
  }&templateId=${encodeURIComponent("system:interview_invitation")}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={backHref}>
          <Button
            variant="outline"
            size="sm"
            className="font-semibold text-xs rounded-lg gap-1.5 shadow-subtle"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Interviews
          </Button>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {canManage ? (
            <>
              <Link href={invitationHref}>
                <Button
                  variant="outline"
                  size="sm"
                  className="font-semibold text-xs rounded-lg gap-1.5 shadow-subtle"
                >
                  <Mail className="h-4 w-4" /> Send Invitation
                </Button>
              </Link>
              <Link href={`/admin/recruitment/interviews/${interview.id}/edit`}>
                <Button
                  variant="outline"
                  size="sm"
                  className="font-semibold text-xs rounded-lg gap-1.5 shadow-subtle"
                >
                  <Pencil className="h-4 w-4" /> Edit Interview
                </Button>
              </Link>
            </>
          ) : null}

          {canManage && interview.status === "scheduled" ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={isPending}
                className="font-semibold text-xs rounded-lg text-red-700 hover:bg-red-50 hover:text-red-800 border-red-200 shadow-subtle"
              >
                Cancel Interview
              </Button>
              <Button
                size="sm"
                onClick={handleComplete}
                disabled={isPending}
                className="font-semibold text-xs rounded-lg shadow-subtle"
              >
                Mark as Completed
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-border bg-card p-6 shadow-subtle space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-primary uppercase tracking-wider">
                  {interview.roundType.replace("_", " ")} Round
                </span>
                <h2 className="text-xl font-extrabold text-foreground mt-1">
                  {interview.title}
                </h2>
              </div>
              {getStatusBadge(interview.status)}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 border-t border-b border-border/60 py-4 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground font-medium">
                <Calendar className="h-4 w-4 text-muted-foreground/60" />
                <span className="text-foreground font-bold">
                  {interview.scheduledStart
                    ? new Date(interview.scheduledStart).toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "Not scheduled"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground font-medium">
                <Clock className="h-4 w-4 text-muted-foreground/60" />
                <span className="text-foreground font-bold">
                  {interview.scheduledStart && interview.scheduledEnd
                    ? `${new Date(interview.scheduledStart).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })} - ${new Date(interview.scheduledEnd).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}`
                    : "—"}
                </span>
              </div>
              {interview.location && (
                <div className="flex items-center gap-2 text-muted-foreground font-medium">
                  <MapPin className="h-4 w-4 text-muted-foreground/60" />
                  <span className="text-foreground font-bold">{interview.location}</span>
                </div>
              )}
              {interview.meetingUrl && (
                <div className="flex items-center gap-2 text-muted-foreground font-medium">
                  <Video className="h-4 w-4 text-muted-foreground/60" />
                  <a
                    href={interview.meetingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline font-bold"
                  >
                    Join Meeting Link
                  </a>
                </div>
              )}
            </div>

            {interview.summary && (
              <div>
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                  Agenda & Description
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {interview.summary}
                </p>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-6 shadow-subtle space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
                Scorecards & Feedback ({interview.feedback.length})
              </h3>
              {canSubmitFeedback && !showFeedbackForm ? (
                <Button
                  size="sm"
                  onClick={() => setShowFeedbackForm(true)}
                  className="font-semibold text-xs rounded-lg gap-1 shadow-subtle"
                >
                  <Plus className="h-4 w-4" /> Submit Scorecard
                </Button>
              ) : null}
            </div>

            {showFeedbackForm ? (
              <div className="bg-muted/10 rounded-xl border border-border/60 p-5">
                <div className="flex items-center justify-between border-b border-border/60 pb-3 mb-4">
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Submit Scorecard
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowFeedbackForm(false)}
                    className="h-7 text-xs font-semibold"
                  >
                    Cancel
                  </Button>
                </div>
                <FeedbackForm
                  interviewId={interview.id}
                  applicationId={interview.applicationId}
                  onSuccess={() => {
                    setShowFeedbackForm(false);
                    router.refresh();
                  }}
                />
              </div>
            ) : null}

            {interview.feedback.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-xs">
                No feedback has been submitted yet for this interview.
              </div>
            ) : (
              <div className="space-y-4 divide-y divide-border/60">
                {interview.feedback.map((feed: any, idx: number) => (
                  <div key={feed.id} className={`pt-4 ${idx === 0 ? "pt-0" : ""}`}>
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div>
                        <div className="font-bold text-foreground text-xs">
                          {feed.author.name}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-medium mt-0.5">
                          Submitted on {new Date(feed.submittedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-bold text-xs">
                          Rating: {feed.overallRating}/5
                        </Badge>
                        <Badge variant="secondary" className="font-bold text-xs capitalize">
                          {feed.recommendation?.replace("_", " ")}
                        </Badge>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 text-xs">
                      <div>
                        <span className="font-bold text-muted-foreground block text-[10px] uppercase tracking-wider mb-1">
                          Strengths
                        </span>
                        <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                          {feed.strengths}
                        </p>
                      </div>
                      {feed.concerns && (
                        <div>
                          <span className="font-bold text-muted-foreground block text-[10px] uppercase tracking-wider mb-1">
                            Concerns
                          </span>
                          <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                            {feed.concerns}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6 shadow-subtle space-y-4">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider border-b border-border pb-3">
              Candidate & Application
            </h3>

            <div className="space-y-3.5 text-xs">
              <div>
                <span className="text-muted-foreground block font-medium mb-1">Candidate</span>
                {canManage ? (
                  <Link
                    href={`/admin/recruitment/candidates/${interview.application.candidate.id}`}
                    className="font-bold text-primary hover:underline"
                  >
                    {interview.application.candidate.fullName}
                  </Link>
                ) : (
                  <span className="font-bold text-foreground">
                    {interview.application.candidate.fullName}
                  </span>
                )}
              </div>

              <div>
                <span className="text-muted-foreground block font-medium mb-1">Job Opening</span>
                <span className="font-bold text-foreground">
                  {interview.application.jobOpening.title}
                </span>
              </div>

              {canManage ? (
                <div>
                  <span className="text-muted-foreground block font-medium mb-1">Application</span>
                  <Link
                    href={`/admin/recruitment/applications/${interview.application.id}`}
                    className="font-bold text-primary hover:underline"
                  >
                    View Full Application
                  </Link>
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 shadow-subtle space-y-4">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider border-b border-border pb-3">
              Interview Panel ({interview.panelists.length})
            </h3>

            {interview.panelists.length === 0 ? (
              <div className="text-xs text-muted-foreground">
                No interviewers assigned to this panel.
              </div>
            ) : (
              <div className="space-y-3">
                {interview.panelists.map((p: any) => (
                  <div key={p.id} className="flex items-center gap-2 text-xs">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-[10px] uppercase">
                      {p.employee.name.charAt(0)}
                    </div>
                    <span className="font-bold text-foreground">{p.employee.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
