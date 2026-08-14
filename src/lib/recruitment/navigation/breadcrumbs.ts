import {
  isSafeRecruitmentReturnTo,
  RECRUITMENT_BASE_PATH,
} from "@/lib/recruitment/navigation/return-to";

export type RecruitmentBreadcrumb = {
  label: string;
  href?: string;
};

export type RecruitmentBreadcrumbSection =
  | "dashboard"
  | "jobs"
  | "candidates"
  | "pipeline"
  | "applications"
  | "interviews"
  | "offers"
  | "conversions"
  | "reports";

export type RecruitmentBreadcrumbInput = {
  section: RecruitmentBreadcrumbSection;
  job?: { id: string; title: string } | null;
  candidate?: { id: string; name: string } | null;
  application?: { id: string; jobTitle?: string } | null;
  leafLabel?: string;
  returnTo?: string | null;
};

export function formatRecruitmentEnumLabel(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function originFromReturnTo(
  returnTo: string | null | undefined
): "pipeline" | "candidate" | "job" | "application" | null {
  if (!isSafeRecruitmentReturnTo(returnTo)) return null;
  const path = returnTo.split("?")[0] ?? returnTo;
  if (path.includes(`${RECRUITMENT_BASE_PATH}/pipeline`)) return "pipeline";
  if (path.includes(`${RECRUITMENT_BASE_PATH}/candidates`)) return "candidate";
  if (path.includes(`${RECRUITMENT_BASE_PATH}/jobs`)) return "job";
  if (path.includes(`${RECRUITMENT_BASE_PATH}/applications`)) return "application";
  return null;
}

function withCurrent(crumbs: RecruitmentBreadcrumb[]): RecruitmentBreadcrumb[] {
  if (crumbs.length === 0) return crumbs;
  return crumbs.map((crumb, index) =>
    index === crumbs.length - 1 ? { label: crumb.label } : crumb
  );
}

export function buildRecruitmentBreadcrumbs(
  input: RecruitmentBreadcrumbInput
): RecruitmentBreadcrumb[] {
  const origin = originFromReturnTo(input.returnTo);
  const crumbs: RecruitmentBreadcrumb[] = [
    { label: "Recruitment", href: RECRUITMENT_BASE_PATH },
  ];

  const pipelineHref = isSafeRecruitmentReturnTo(input.returnTo)
    ? input.returnTo
    : `${RECRUITMENT_BASE_PATH}/pipeline`;

  const pushJob = (current: boolean) => {
    if (!input.job) return;
    crumbs.push({
      label: "Jobs",
      href: current ? undefined : `${RECRUITMENT_BASE_PATH}/jobs`,
    });
    crumbs.push({
      label: input.job.title,
      href: current ? undefined : `${RECRUITMENT_BASE_PATH}/jobs/${input.job.id}`,
    });
  };

  const pushCandidate = (current: boolean) => {
    if (!input.candidate) return;
    crumbs.push({
      label: "Candidates",
      href: current ? undefined : `${RECRUITMENT_BASE_PATH}/candidates`,
    });
    crumbs.push({
      label: input.candidate.name,
      href: current ? undefined : `${RECRUITMENT_BASE_PATH}/candidates/${input.candidate.id}`,
    });
  };

  const applicationLabel = input.application
    ? `Application: ${input.application.jobTitle ?? input.job?.title ?? "Role"}`
    : null;

  if (input.section === "dashboard") {
    crumbs.push({ label: "Dashboard" });
    return crumbs;
  }

  if (input.section === "jobs" && !input.application && !input.candidate) {
    crumbs.push({ label: "Jobs", href: `${RECRUITMENT_BASE_PATH}/jobs` });
    if (input.job) crumbs.push({ label: input.job.title });
    if (input.leafLabel) crumbs.push({ label: input.leafLabel });
    return withCurrent(crumbs);
  }

  /**
   * Candidate page: the viewed Candidate is always the leaf/current crumb.
   * Preserve Pipeline / Job / Application parents when return context exists.
   */
  if (input.section === "candidates") {
    if (origin === "pipeline") {
      crumbs.push({ label: "Pipeline", href: pipelineHref });
      if (input.job) {
        crumbs.push({
          label: input.job.title,
          href: `${RECRUITMENT_BASE_PATH}/jobs/${input.job.id}`,
        });
      }
    } else if (origin === "job" && input.job) {
      pushJob(false);
    } else if (origin === "application" && input.application) {
      crumbs.push({ label: "Pipeline", href: `${RECRUITMENT_BASE_PATH}/pipeline` });
    } else {
      crumbs.push({ label: "Candidates", href: `${RECRUITMENT_BASE_PATH}/candidates` });
    }

    if (input.application && applicationLabel) {
      crumbs.push({
        label: applicationLabel,
        href: `${RECRUITMENT_BASE_PATH}/applications/${input.application.id}`,
      });
    }

    if (input.candidate) {
      crumbs.push({ label: input.candidate.name });
    }
    if (input.leafLabel) {
      crumbs.push({ label: input.leafLabel });
    }
    return withCurrent(crumbs);
  }

  if (input.section === "pipeline" && !input.application && !input.leafLabel) {
    crumbs.push({ label: "Pipeline", href: `${RECRUITMENT_BASE_PATH}/pipeline` });
    if (input.job) crumbs.push({ label: input.job.title });
    return withCurrent(crumbs);
  }

  if (input.section === "reports") {
    crumbs.push({ label: "Reports", href: `${RECRUITMENT_BASE_PATH}/reports` });
    if (input.leafLabel) crumbs.push({ label: input.leafLabel });
    return withCurrent(crumbs);
  }

  if (origin === "pipeline" || input.section === "pipeline") {
    crumbs.push({ label: "Pipeline", href: pipelineHref });
    if (input.job) {
      crumbs.push({
        label: input.job.title,
        href: `${RECRUITMENT_BASE_PATH}/jobs/${input.job.id}`,
      });
    }
  } else if (origin === "job" && input.job) {
    pushJob(false);
    crumbs.push({ label: "Pipeline", href: pipelineHref });
  } else if (input.candidate) {
    pushCandidate(false);
  } else if (input.job) {
    pushJob(false);
  } else if (input.section === "interviews") {
    crumbs.push({ label: "Interviews", href: `${RECRUITMENT_BASE_PATH}/interviews` });
  } else if (input.section === "offers") {
    crumbs.push({ label: "Offers", href: `${RECRUITMENT_BASE_PATH}/offers` });
  } else if (input.section === "conversions") {
    crumbs.push({ label: "Conversions", href: `${RECRUITMENT_BASE_PATH}/conversions` });
  } else if (input.section === "applications") {
    crumbs.push({ label: "Pipeline", href: `${RECRUITMENT_BASE_PATH}/pipeline` });
  }

  if (input.application && applicationLabel) {
    const isApplicationCurrent =
      (input.section === "applications" || input.section === "pipeline") && !input.leafLabel;
    crumbs.push({
      label: applicationLabel,
      href: isApplicationCurrent
        ? undefined
        : `${RECRUITMENT_BASE_PATH}/applications/${input.application.id}`,
    });
  }

  if (input.section === "interviews" && input.leafLabel) {
    if (!crumbs.some((c) => c.label === "Interviews" && c.href)) {
      crumbs.push({ label: "Interviews", href: `${RECRUITMENT_BASE_PATH}/interviews` });
    }
    crumbs.push({ label: input.leafLabel });
  } else if (input.section === "offers" && input.leafLabel) {
    crumbs.push({ label: input.leafLabel });
  } else if (input.section === "conversions" && input.leafLabel) {
    crumbs.push({ label: input.leafLabel });
  } else if (input.leafLabel) {
    crumbs.push({ label: input.leafLabel });
  }

  return withCurrent(crumbs);
}
