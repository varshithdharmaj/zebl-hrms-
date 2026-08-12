"use client";

import React, { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { CandidateDetail } from "@/lib/recruitment/candidate/types";
import type { TimelineItem } from "@/lib/recruitment/types/timeline";
import {
  buildCandidateWorkspaceTabHref,
  type CandidateWorkspaceTab,
} from "@/lib/recruitment/candidate/workspace-tab";
import { AppTabs } from "@/components/ui/app-tabs";
import { CandidateStatusBadge } from "./candidate-status-badge";
import { CandidateSourceBadge } from "./candidate-source-badge";
import { CandidateSection } from "./candidate-section";
import { CandidateInfoItem } from "./candidate-info-item";
import { CandidateMetaRow } from "./candidate-meta-row";
import { CandidateEmptyState } from "./candidate-empty-state";
import { CandidateDocumentsCard } from "./candidate-documents-card";
import { CandidateAvatar } from "./candidate-avatar";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/error-alert";
import { AlertDialog } from "@/components/ui/alert-dialog";
import {
  archiveCandidateAction,
  restoreCandidateAction,
  addCandidateNoteAction,
} from "@/actions/recruitment-candidates";
import { Textarea } from "@/components/ui/textarea";
import {
  User,
  Mail,
  Phone,
  Briefcase,
  GraduationCap,
  Award,
  FolderGit2,
  FileText,
  Calendar,
  Clock,
  MapPin,
  Globe,
  IndianRupee,
  Archive,
  RotateCcw,
  Edit,
  ClipboardList,
  MessagesSquare,
} from "lucide-react";
import { AddCandidateFieldButton } from "./add-candidate-field-dialog";
import { CandidateAiInsightsCard } from "./candidate-ai-insights-card";
import { CandidateAiRecoveryCard } from "./candidate-ai-recovery-card";
import { hasMissingAddableFields } from "@/lib/recruitment/candidate/addable-fields";
import type { CandidateEnrichmentInsightContent } from "@/lib/recruitment/ai/types";
import type { ResumeFieldRecoveryInsightContent } from "@/lib/recruitment/ai/recovery-types";
import {
  buildPipelineHref,
  buildRecruitmentEntityHref,
} from "@/lib/recruitment/navigation/return-to";
import { formatRecruitmentEnumLabel } from "@/lib/recruitment/navigation/breadcrumbs";

const NOTE_MAX_LENGTH = 5000;
function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type WorkspaceTab = CandidateWorkspaceTab;

type CandidateApplicationRow = {
  id: string;
  status: string;
  currentStage: string;
  jobOpeningId?: string;
  jobTitle: string;
  createdAt: Date | string;
};

type CandidateNavContext = {
  returnTo?: string | null;
  originatingApplicationId?: string | null;
  jobOpeningId?: string | null;
  currentStage?: string | null;
};

export function CandidateDetailView({
  candidate,
  timeline = [],
  employeeOptions = [],
  interviews = [],
  offers = [],
  applications = [],
  applicationCount,
  canWriteDiscussion = false,
  canManageCandidate = false,
  aiEnrichment,
  aiRecovery,
  bannerNotice = null,
  navContext,
  initialTab = "overview",
}: {
  candidate: CandidateDetail;
  timeline?: readonly TimelineItem[];
  employeeOptions?: { id: number; name: string; user: { id: string; email: string } | null }[];
  interviews?: ReadonlyArray<{
    id: string;
    title: string;
    scheduledStart: Date | string;
    roundType: string;
    status: string;
  }>;
  offers?: ReadonlyArray<{
    id: string;
    offerNumber?: string | null;
    ctc?: number | string | null;
    currency?: string | null;
    status: string;
    application?: {
      jobOpening?: { title?: string | null } | null;
    } | null;
  }>;
  applications?: CandidateApplicationRow[];
  applicationCount?: number;
  canWriteDiscussion?: boolean;
  canManageCandidate?: boolean;
  aiEnrichment?: {
    insightId: string | null;
    status: string | null;
    content: CandidateEnrichmentInsightContent | null;
    sourceDraftId: string | null;
    isStale?: boolean;
  };
  aiRecovery?: {
    insightId: string | null;
    status: string | null;
    content: ResumeFieldRecoveryInsightContent | null;
    sourceDraftId: string | null;
    isStale?: boolean;
  };
  /** One-shot recoverable notice (e.g. resume attach failed after create). */
  bannerNotice?: string | null;
  navContext?: CandidateNavContext;
  initialTab?: WorkspaceTab;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const createApplicationHref = `/admin/recruitment/applications/new?candidateId=${encodeURIComponent(candidate.id)}`;
  const applicationHref = (app: CandidateApplicationRow) =>
    buildRecruitmentEntityHref(`/admin/recruitment/applications/${app.id}`, {
      returnTo: `/admin/recruitment/candidates/${candidate.id}`,
      jobOpeningId: app.jobOpeningId || navContext?.jobOpeningId,
      currentStage: app.currentStage,
    });
  const pipelineHrefForApp = (app: CandidateApplicationRow) =>
    buildPipelineHref({
      applicationId: app.id,
      jobOpeningId: app.jobOpeningId || undefined,
      currentStage: app.currentStage,
    });
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(initialTab);
  const [isPending, startTransition] = useTransition();
  const [, startTabTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [noteBody, setNoteBody] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [isNotePending, startNoteTransition] = useTransition();
  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    actionLabel?: string;
    onAction: () => void;
    isDestructive?: boolean;
  } | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const employeeMap = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const emp of employeeOptions) {
      if (emp.user?.id) map.set(emp.user.id, emp.name);
    }
    return map;
  }, [employeeOptions]);

  const recruiterName = candidate.primaryRecruiterName?.trim()
    ? candidate.primaryRecruiterName
    : candidate.primaryRecruiterUserId
      ? employeeMap.get(candidate.primaryRecruiterUserId) ?? "—"
      : "—";

  const documentTabCount = candidate.documentCount ?? candidate.documents.length;

  const applicationTabCount = applicationCount ?? applications.length;

  const activityTimeline = timeline.map((item) => ({
    id: `timeline:${item.id}`,
    occurredAt: item.createdAt instanceof Date ? item.createdAt : new Date(item.createdAt),
    source: "other" as const,
    eventType: item.eventType,
    summary: item.summary,
  }));

  const handleTabChange = (id: string) => {
    const nextTab = id as WorkspaceTab;
    const currentQuery: Record<string, string | string[] | undefined> = {};
    searchParams.forEach((value, key) => {
      currentQuery[key] = value;
    });
    const href = buildCandidateWorkspaceTabHref(pathname, currentQuery, nextTab);
    startTabTransition(() => {
      router.push(href);
    });
  };

  const runArchive = () => {
    setAlertConfig({
      isOpen: true,
      title: "Archive Candidate Profile",
      description: `Archive ${candidate.fullName}?`,
      actionLabel: "Archive Profile",
      isDestructive: true,
      onAction: () => {
        setError(null);
        startTransition(async () => {
          const res = await archiveCandidateAction({}, { id: candidate.id });
          if (res.error) setError(res.error);
          else {
            setSuccess(res.success ?? "Candidate archived.");
            router.refresh();
          }
        });
      },
    });
  };

  const runRestore = () => {
    setAlertConfig({
      isOpen: true,
      title: "Restore Candidate Profile",
      description: `Restore ${candidate.fullName}?`,
      actionLabel: "Restore Profile",
      onAction: () => {
        setError(null);
        startTransition(async () => {
          const res = await restoreCandidateAction({}, { id: candidate.id });
          if (res.error) setError(res.error);
          else {
            setSuccess(res.success ?? "Candidate restored.");
            router.refresh();
          }
        });
      },
    });
  };

  const submitNote = () => {
    const trimmed = noteBody.trim();
    if (!trimmed) {
      setNoteError("Note body is required.");
      return;
    }
    if (trimmed.length > NOTE_MAX_LENGTH) {
      setNoteError(`Note must be ${NOTE_MAX_LENGTH} characters or fewer.`);
      return;
    }
    setNoteError(null);
    setError(null);
    startNoteTransition(async () => {
      const res = await addCandidateNoteAction(
        {},
        { candidateId: candidate.id, body: trimmed }
      );
      if (res.error) {
        setNoteError(res.error);
        return;
      }
      setNoteBody("");
      setSuccess(res.success ?? "Note added.");
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      {bannerNotice && (
        <div
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-500/10 dark:text-amber-200"
        >
          {bannerNotice}
        </div>
      )}
      {error && <ErrorAlert message={error} />}
      {success && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/30 dark:bg-emerald-500/10 dark:text-emerald-400">
          {success}
        </p>
      )}

      <AppTabs
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "applications", label: "Applications", count: applicationTabCount },
          { id: "documents", label: "Documents", count: documentTabCount },
          { id: "activity", label: "Activity" },
        ]}
        active={activeTab}
        onChange={handleTabChange}
      />

      {activeTab === "documents" && (
        <CandidateDocumentsCard candidateId={candidate.id} documents={candidate.documents} />
      )}

      {activeTab === "activity" && (
        <CandidateSection title="Activity" description="Merged recruitment timeline.">
          {activityTimeline.length === 0 ? (
            <CandidateEmptyState
              icon={Calendar}
              title="No activity recorded"
              description="Events will appear as the candidate moves through hiring."
            />
          ) : (
            <ul className="space-y-4">
              {activityTimeline.map((item) => (
                <li
                  key={item.id}
                  className="relative ml-2 border-l-2 border-border/80 pl-4 animate-in fade-in-50 duration-150"
                >
                  <div className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-primary/50 ring-4 ring-background" />
                  <p className="text-xs font-semibold leading-relaxed text-foreground">{item.summary}</p>
                  <p className="mt-1 flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {"source" in item ? `${item.source} · ` : ""}
                    {formatDate(item.occurredAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CandidateSection>
      )}

      {activeTab === "applications" && (
        <div className="space-y-6">
          <CandidateSection
            title="Applications"
            description="Jobs this candidate has applied to."
            action={
              <Button asChild size="sm" className="font-semibold text-xs shadow-subtle">
                <Link href={createApplicationHref}>
                  New Application
                </Link>
              </Button>
            }
          >
            {applications.length === 0 ? (
              <CandidateEmptyState
                icon={ClipboardList}
                title="No applications"
                description="Link this candidate to a job from Pipeline or create an application."
              />
            ) : (
              <div className="space-y-3">
                {applications.map((app) => (
                  <div
                    key={app.id}
                    className="flex items-center justify-between rounded-xl border border-border/60 bg-card p-3.5"
                  >
                    <div>
                      <h4 className="text-xs font-bold text-foreground">{app.jobTitle}</h4>
                      <p className="mt-1 text-[11px] font-medium text-muted-foreground">
                        {app.currentStage.replace(/_/g, " ")} · {app.status} · {formatDate(app.createdAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm" className="text-xs font-semibold">
                        <Link href={applicationHref(app)}>Open Application</Link>
                      </Button>
                      <Button asChild variant="outline" size="sm" className="text-xs font-semibold">
                        <Link href={pipelineHrefForApp(app)}>Open in Pipeline</Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CandidateSection>

          <CandidateSection title="Interviews" description="Interview history across applications.">
            {interviews.length === 0 ? (
              <CandidateEmptyState icon={Calendar} title="No interviews" description="No interview history yet." />
            ) : (
              <div className="space-y-3">
                {interviews.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl border border-border/60 bg-card p-3.5"
                  >
                    <div>
                      <h4 className="text-xs font-bold">{item.title}</h4>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {new Date(item.scheduledStart).toLocaleDateString()} · {item.roundType.replace(/_/g, " ")}
                      </p>
                    </div>
                    <Button asChild variant="outline" size="sm" className="text-xs font-semibold">
                      <Link href={`/admin/recruitment/interviews/${item.id}`}>View</Link>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CandidateSection>

          <CandidateSection title="Offers" description="Offers issued to this candidate.">
            {offers.length === 0 ? (
              <CandidateEmptyState icon={FileText} title="No offers" description="No offers yet." />
            ) : (
              <div className="space-y-3">
                {offers.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl border border-border/60 bg-card p-3.5"
                  >
                    <div>
                      <h4 className="text-xs font-bold">{item.offerNumber || "Draft Offer"}</h4>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {item.application?.jobOpening?.title || "N/A"} · {item.status}
                      </p>
                    </div>
                    <Button asChild variant="outline" size="sm" className="text-xs font-semibold">
                      <Link href={`/admin/recruitment/offers/${item.id}`}>View</Link>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CandidateSection>
        </div>
      )}

      {activeTab === "overview" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <CandidateSection
              title="Applications"
              description="This candidate’s hiring journeys. Each application belongs to one job."
              action={
                <Button asChild size="sm" className="font-semibold text-xs shadow-subtle">
                  <Link href={createApplicationHref}>Create Application</Link>
                </Button>
              }
            >
              {applications.length === 0 ? (
                <CandidateEmptyState
                  icon={ClipboardList}
                  title="No applications yet"
                  description="This candidate is not attached to a job. Create an application when you are ready to start hiring."
                />
              ) : (
                <div className="space-y-3">
                  {applications.map((app) => {
                    const isOriginating = navContext?.originatingApplicationId === app.id;
                    return (
                      <div
                        key={app.id}
                        className={`flex items-center justify-between rounded-xl border bg-card p-3.5 ${
                          isOriginating ? "border-primary/50" : "border-border/60"
                        }`}
                      >
                        <div>
                          <h4 className="text-xs font-bold text-foreground">{app.jobTitle}</h4>
                          <p className="mt-1 text-[11px] font-medium text-muted-foreground">
                            {formatRecruitmentEnumLabel(app.currentStage)} ·{" "}
                            {formatRecruitmentEnumLabel(app.status)}
                          </p>
                        </div>
                        <Button asChild variant="outline" size="sm" className="text-xs font-semibold">
                          <Link href={applicationHref(app)}>Open Application</Link>
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CandidateSection>

            {canManageCandidate && hasMissingAddableFields(candidate) ? (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-4 py-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground">Complete profile</p>
                  <p className="text-[11px] text-muted-foreground">
                    Add missing single-value details without opening the full edit form.
                  </p>
                </div>
                <AddCandidateFieldButton
                  candidate={candidate}
                  onSuccess={(message) => {
                    setSuccess(message);
                    router.refresh();
                  }}
                />
              </div>
            ) : null}

            {canManageCandidate || aiEnrichment?.content ? (
              <CandidateAiInsightsCard
                candidateId={candidate.id}
                insightId={aiEnrichment?.insightId ?? null}
                status={aiEnrichment?.status ?? null}
                content={aiEnrichment?.content ?? null}
                sourceDraftId={aiEnrichment?.sourceDraftId ?? null}
                isStale={Boolean(aiEnrichment?.isStale)}
                canManage={Boolean(canManageCandidate)}
                profileHeadline={candidate.headline}
                profileSummary={candidate.professionalSummary}
              />
            ) : null}

            {canManageCandidate || aiRecovery?.content ? (
              <CandidateAiRecoveryCard
                candidateId={candidate.id}
                insightId={aiRecovery?.insightId ?? null}
                status={aiRecovery?.status ?? null}
                content={aiRecovery?.content ?? null}
                sourceDraftId={
                  aiRecovery?.sourceDraftId ?? aiEnrichment?.sourceDraftId ?? null
                }
                isStale={Boolean(aiRecovery?.isStale)}
                canManage={Boolean(canManageCandidate)}
              />
            ) : null}

            <CandidateSection title="Personal" description="Identity, contact, and location.">
              <dl className="grid gap-4 sm:grid-cols-2">
                <CandidateInfoItem label="Full Name" value={candidate.fullName} icon={User} />
                <CandidateInfoItem label="First Name" value={candidate.firstName} icon={User} />
                <CandidateInfoItem label="Last Name" value={candidate.lastName} icon={User} />
                <CandidateInfoItem label="Preferred Name" value={candidate.preferredName} icon={User} />
                <CandidateInfoItem
                  label="Email"
                  value={
                    candidate.email ? (
                      <a href={`mailto:${candidate.email}`} className="font-semibold text-primary hover:underline">
                        {candidate.email}
                      </a>
                    ) : null
                  }
                  icon={Mail}
                />
                <CandidateInfoItem
                  label="Phone"
                  value={
                    candidate.phone ? (
                      <a href={`tel:${candidate.phone}`} className="font-semibold text-primary hover:underline">
                        {candidate.phone}
                      </a>
                    ) : null
                  }
                  icon={Phone}
                />
                <CandidateInfoItem
                  label="Alternate Phone"
                  value={
                    candidate.alternatePhone ? (
                      <a
                        href={`tel:${candidate.alternatePhone}`}
                        className="font-semibold text-primary hover:underline"
                      >
                        {candidate.alternatePhone}
                      </a>
                    ) : null
                  }
                  icon={Phone}
                />
                <CandidateInfoItem label="Date of Birth" value={formatDate(candidate.dateOfBirth)} icon={Calendar} />
                <CandidateInfoItem label="Current Location" value={candidate.location} icon={MapPin} />
                <CandidateInfoItem
                  label="Preferred Location"
                  value={candidate.personal?.preferredLocation}
                  icon={MapPin}
                />
                <CandidateInfoItem label="Nationality" value={candidate.personal?.nationality} icon={Globe} />
              </dl>
            </CandidateSection>

            <CandidateSection title="Professional" description="Role summary and current employment.">
              <dl className="grid gap-4 sm:grid-cols-2">
                <CandidateInfoItem label="Headline" value={candidate.headline} icon={Briefcase} />
                <CandidateInfoItem
                  label="Total Experience"
                  value={
                    candidate.totalExperienceYears != null
                      ? `${candidate.totalExperienceYears} Years`
                      : null
                  }
                  icon={Clock}
                />
                <CandidateInfoItem label="Current Company" value={candidate.currentCompany} icon={Briefcase} />
                <CandidateInfoItem
                  label="Current Designation"
                  value={candidate.currentTitle}
                  icon={Briefcase}
                />
                {candidate.professionalSummary ? (
                  <div className="sm:col-span-2 space-y-1.5">
                    <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Professional Summary
                    </dt>
                    <dd className="whitespace-pre-wrap text-sm text-foreground leading-relaxed">
                      {candidate.professionalSummary}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </CandidateSection>

            <CandidateSection title="Compensation" description="CTC expectations.">
              <dl className="grid gap-4 sm:grid-cols-2">
                <CandidateInfoItem
                  label="Current CTC"
                  value={candidate.currentCtc ? `${candidate.currentCtc} ${candidate.currency}` : null}
                  icon={IndianRupee}
                />
                <CandidateInfoItem
                  label="Expected CTC"
                  value={candidate.expectedCtc ? `${candidate.expectedCtc} ${candidate.currency}` : null}
                  icon={IndianRupee}
                />
              </dl>
            </CandidateSection>

            <CandidateSection title="Availability" description="Notice period and work preferences.">
              <dl className="grid gap-4 sm:grid-cols-2">
                <CandidateInfoItem
                  label="Notice Period"
                  value={candidate.noticePeriodDays != null ? `${candidate.noticePeriodDays} Days` : null}
                  icon={Clock}
                />
                <CandidateInfoItem
                  label="Earliest Joining"
                  value={formatDate(candidate.earliestJoinDate)}
                  icon={Calendar}
                />
                <CandidateInfoItem
                  label="Preferred Work Mode"
                  value={
                    candidate.preferredWorkMode
                      ? candidate.preferredWorkMode.charAt(0).toUpperCase() +
                        candidate.preferredWorkMode.slice(1)
                      : null
                  }
                  icon={MapPin}
                />
                <CandidateInfoItem
                  label="Willing To Relocate"
                  value={
                    candidate.willingToRelocate == null
                      ? null
                      : candidate.willingToRelocate
                        ? "Yes"
                        : "No"
                  }
                  icon={Globe}
                />
                {candidate.availabilityNotes ? (
                  <div className="sm:col-span-2 space-y-1.5">
                    <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Availability Notes
                    </dt>
                    <dd className="whitespace-pre-wrap text-sm text-foreground leading-relaxed">
                      {candidate.availabilityNotes}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </CandidateSection>

            <CandidateSection title="Online Profiles" description="Public professional links.">
              <dl className="grid gap-4 sm:grid-cols-2">
                <CandidateInfoItem
                  label="LinkedIn"
                  value={
                    candidate.linkedinUrl ? (
                      <a
                        href={candidate.linkedinUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-primary hover:underline break-all"
                      >
                        {candidate.linkedinUrl}
                      </a>
                    ) : null
                  }
                  icon={Globe}
                />
                <CandidateInfoItem
                  label="GitHub"
                  value={
                    candidate.githubUrl ? (
                      <a
                        href={candidate.githubUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-primary hover:underline break-all"
                      >
                        {candidate.githubUrl}
                      </a>
                    ) : null
                  }
                  icon={FolderGit2}
                />
                <CandidateInfoItem
                  label="Portfolio"
                  value={
                    candidate.personal?.portfolioUrl ? (
                      <a
                        href={candidate.personal.portfolioUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-primary hover:underline break-all"
                      >
                        {candidate.personal.portfolioUrl}
                      </a>
                    ) : null
                  }
                  icon={Globe}
                />
              </dl>
            </CandidateSection>

            <CandidateSection title="Experience History" description="Previous professional roles.">
              {candidate.experiences.length === 0 ? (
                <CandidateEmptyState icon={Briefcase} title="No experience added" description="No experience records yet." />
              ) : (
                <div className="space-y-6">
                  {candidate.experiences.map((exp) => (
                    <div key={exp.id} className="relative ml-2.5 border-l-2 border-border/80 pl-5">
                      <div className="absolute -left-[6px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background" />
                      <h4 className="text-sm font-bold">{exp.designation || exp.title}</h4>
                      <p className="mt-0.5 text-xs font-semibold text-primary">{exp.companyName || exp.company}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDate(exp.startDate)} –{" "}
                        {exp.currentlyWorking || exp.isCurrent ? "Present" : formatDate(exp.endDate)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CandidateSection>

            <CandidateSection title="Education History" description="Academic background.">
              {candidate.educations.length === 0 ? (
                <CandidateEmptyState icon={GraduationCap} title="No education added" description="No education records yet." />
              ) : (
                <div className="space-y-6">
                  {candidate.educations.map((edu) => (
                    <div key={edu.id} className="relative ml-2.5 border-l-2 border-border/80 pl-5">
                      <div className="absolute -left-[6px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background" />
                      <h4 className="text-sm font-bold">
                        {edu.degree} in {edu.fieldOfStudy || edu.field}
                      </h4>
                      <p className="mt-0.5 text-xs font-semibold text-primary">{edu.institution}</p>
                    </div>
                  ))}
                </div>
              )}
            </CandidateSection>

            <CandidateSection title="Skills & Proficiency" description="Core competencies.">
              {candidate.skills.length === 0 ? (
                <CandidateEmptyState icon={Award} title="No skills added" description="No skills listed yet." />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {candidate.skills.map((sk) => (
                    <span
                      key={sk.id}
                      className="inline-flex items-center rounded-full border border-primary/10 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary"
                    >
                      {sk.skillName || sk.name}
                    </span>
                  ))}
                </div>
              )}
            </CandidateSection>

            <CandidateSection title="Projects" description="Portfolio highlights.">
              {candidate.projects.length === 0 ? (
                <CandidateEmptyState icon={FolderGit2} title="No projects added" description="No projects yet." />
              ) : (
                <div className="space-y-4">
                  {candidate.projects.map((proj) => (
                    <div key={proj.id}>
                      <h4 className="text-sm font-bold">{proj.title}</h4>
                      {(proj.description || proj.summary) && (
                        <p className="mt-1 text-xs text-muted-foreground">{proj.description || proj.summary}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CandidateSection>

            <CandidateSection
              title="Discussion"
              description="Recruiters and hiring managers can collaborate on this candidate."
            >
              {canWriteDiscussion ? (
                <div className="mb-4 space-y-2">
                  <label htmlFor="candidate-discussion-note" className="sr-only">
                    Discussion note
                  </label>
                  <Textarea
                    id="candidate-discussion-note"
                    value={noteBody}
                    onChange={(e) => {
                      setNoteBody(e.target.value);
                      if (noteError) setNoteError(null);
                    }}
                    rows={3}
                    maxLength={NOTE_MAX_LENGTH}
                    placeholder="Add a discussion note..."
                    disabled={isNotePending}
                    className="resize-y"
                  />
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-medium text-muted-foreground tabular-nums">
                      {noteBody.trim().length}/{NOTE_MAX_LENGTH}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      className="font-semibold shadow-subtle"
                      disabled={isNotePending || !noteBody.trim()}
                      onClick={submitNote}
                    >
                      {isNotePending ? "Saving…" : "Add note"}
                    </Button>
                  </div>
                  {noteError && <ErrorAlert message={noteError} />}
                </div>
              ) : null}

              {candidate.notes.length === 0 ? (
                <CandidateEmptyState
                  icon={MessagesSquare}
                  title="No discussion yet"
                  description={
                    canWriteDiscussion
                      ? "Add a note to start collaborating on this candidate."
                      : "Discussion notes will appear here when the hiring team posts."
                  }
                />
              ) : (
                <ul className="space-y-3" aria-label="Candidate discussion">
                  {candidate.notes.map((note) => (
                    <li
                      key={note.id}
                      className="flex gap-3 rounded-lg border border-border/80 bg-card p-4 text-sm"
                    >
                      <CandidateAvatar
                        fullName={note.authorName}
                        imageUrl={note.avatarUrl}
                        className="mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span className="font-semibold text-foreground">
                            {note.authorName}
                          </span>
                          {note.roleLabel ? (
                            <span className="text-[11px] font-medium text-muted-foreground">
                              {note.roleLabel}
                            </span>
                          ) : null}
                          <time
                            className="text-[11px] text-muted-foreground"
                            dateTime={
                              note.createdAt instanceof Date
                                ? note.createdAt.toISOString()
                                : String(note.createdAt)
                            }
                          >
                            {formatDateTime(note.createdAt)}
                          </time>
                        </div>
                        <p className="mt-1.5 whitespace-pre-wrap text-foreground">
                          {note.content || note.body}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CandidateSection>
          </div>

          <div className="space-y-6">
            <CandidateSection title="Lifecycle & Status" description="Current ATS categorization.">
              <div className="space-y-1">
                <CandidateMetaRow
                  label="Status"
                  value={<CandidateStatusBadge status={candidate.status} className="px-2.5 py-0.5 text-xs font-semibold" />}
                />
                <CandidateMetaRow
                  label="Source"
                  value={<CandidateSourceBadge source={candidate.source} className="px-2.5 py-0.5 text-xs font-semibold" />}
                />
                <CandidateMetaRow label="Primary Recruiter" value={recruiterName} />
                <CandidateMetaRow label="Date Created" value={formatDate(candidate.createdAt)} />
                <CandidateMetaRow label="Last Updated" value={formatDate(candidate.updatedAt)} />
              </div>
              <div className="mt-6 flex flex-col gap-2 border-t border-border pt-5">
                {canManageCandidate ? (
                  <>
                    <Button variant="outline" size="sm" asChild className="w-full justify-center font-semibold shadow-subtle">
                      <Link href={`/admin/recruitment/candidates/${candidate.id}/edit`}>
                        <Edit className="mr-1.5 h-4 w-4" />
                        Edit Profile
                      </Link>
                    </Button>
                    {candidate.status !== "archived" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={runArchive}
                        loading={isPending}
                        className="w-full justify-center font-semibold text-muted-foreground hover:border-danger/30 hover:text-danger"
                      >
                        <Archive className="mr-1.5 h-4 w-4" />
                        Archive Profile
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={runRestore}
                        loading={isPending}
                        className="w-full justify-center font-semibold"
                      >
                        <RotateCcw className="mr-1.5 h-4 w-4" />
                        Restore Profile
                      </Button>
                    )}
                  </>
                ) : null}
              </div>
            </CandidateSection>
          </div>
        </div>
      )}

      {alertConfig && (
        <AlertDialog
          isOpen={alertConfig.isOpen}
          onOpenChange={(open) => setAlertConfig(open ? alertConfig : null)}
          title={alertConfig.title}
          description={alertConfig.description}
          actionLabel={alertConfig.actionLabel}
          isActionDestructive={alertConfig.isDestructive}
          isPending={isPending}
          onAction={() => {
            alertConfig.onAction();
            setAlertConfig(null);
          }}
        />
      )}
    </div>
  );
}
