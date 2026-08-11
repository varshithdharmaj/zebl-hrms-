import type { SessionUser } from "@/lib/session";
import { canAccessRecruitmentAdministration } from "@/lib/recruitment/permissions/recruitment-test-manager";
import {
  getDepartmentAnalyticsCached,
  getHiringFunnelCached,
  getInterviewAnalyticsCached,
  getOfferAnalyticsCached,
  getPipelineMetricsCached,
  getRecruiterPerformanceCached,
  getSourceAnalyticsCached,
  getTimeMetricsCached,
  getTrendDataCached,
  getExecutiveKPIsCached,
} from "@/lib/recruitment/analytics";
import { getCommunicationAnalyticsCached } from "@/lib/recruitment/communication";
import { getConversionDashboardMetricsCached } from "@/lib/recruitment/conversion/queries";
import { analyticsFilterFromReport } from "./parse-filters";
import type {
  ReportBundle,
  ReportChart,
  ReportSectionKey,
  ReportTable,
  RecruitmentReportFilters,
} from "./types";

function applySearch<T extends Record<string, unknown>>(
  rows: T[],
  search: string | undefined,
  keys: string[]
): T[] {
  const q = search?.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) =>
    keys.some((key) => String(row[key] ?? "").toLowerCase().includes(q))
  );
}

export async function buildReportBundle(
  session: SessionUser,
  section: ReportSectionKey,
  filters: RecruitmentReportFilters
): Promise<ReportBundle> {
  const analyticsFilters = analyticsFilterFromReport(filters);
  const days = filters.days ?? 7;
  const generatedAt = new Date().toISOString();

  if (section === "hiring") {
    const [kpis, funnel, pipeline, department, sources, time, trends] =
      await Promise.all([
        getExecutiveKPIsCached(session, analyticsFilters),
        getHiringFunnelCached(session, analyticsFilters),
        getPipelineMetricsCached(session, analyticsFilters),
        getDepartmentAnalyticsCached(session, analyticsFilters),
        getSourceAnalyticsCached(session, analyticsFilters),
        getTimeMetricsCached(session, analyticsFilters),
        getTrendDataCached(session, { ...analyticsFilters, days }),
      ]);

    let recruiter: Awaited<ReturnType<typeof getRecruiterPerformanceCached>> = [];
    if (canAccessRecruitmentAdministration(session)) {
      try {
        recruiter = await getRecruiterPerformanceCached(session, analyticsFilters);
      } catch {
        recruiter = [];
      }
    }

    const charts: ReportChart[] = [
      {
        id: "funnel",
        title: "Hiring Funnel",
        kind: "bar",
        labels: [
          "Candidates",
          "Applications",
          "Interviews",
          "Offers",
          "Accepted",
          "Employees",
        ],
        series: [
          {
            label: "Count",
            values: [
              funnel.candidates,
              funnel.applications,
              funnel.interviews,
              funnel.offers,
              funnel.accepted,
              funnel.employees,
            ],
            color: "#0f766e",
          },
        ],
      },
      {
        id: "pipeline-by-stage",
        title: "Pipeline by stage (counts)",
        kind: "stacked",
        labels: pipeline.byStage.map((row) => row.stage),
        series: [
          {
            label: "Candidates",
            values: pipeline.byStage.map((row) => row.count),
            color: "#2563eb",
          },
        ],
      },
      {
        id: "sources",
        title: "Candidate Sources",
        kind: "pie",
        labels: sources.map((row) => row.source),
        series: [
          {
            label: "Applications",
            values: sources.map((row) => row.applications),
            color: "#0891b2",
          },
        ],
      },
      {
        id: "trends",
        title: "Hiring Trends",
        kind: "line",
        labels: trends.dates,
        series: [
          { label: "Applications", values: trends.applications, color: "#2563eb" },
          { label: "Interviews", values: trends.interviews, color: "#0f766e" },
          { label: "Offers", values: trends.offers, color: "#16a34a" },
          { label: "Hires", values: trends.hires, color: "#d97706" },
        ],
      },
    ];

    const tables: ReportTable[] = [
      {
        id: "recruiter-performance",
        title: "Recruiter Performance",
        columns: [
          { key: "recruiterEmail", label: "Recruiter" },
          { key: "openJobs", label: "Open jobs" },
          { key: "candidates", label: "Candidates" },
          { key: "interviews", label: "Interviews" },
          { key: "offers", label: "Offers" },
          { key: "hires", label: "Hires" },
          { key: "acceptanceRate", label: "Accept %" },
          { key: "avgTimeToHire", label: "Avg TTH" },
        ],
        rows: applySearch(
          recruiter.map((row) => ({
            id: row.recruiterId,
            recruiterEmail: row.recruiterEmail,
            openJobs: row.openJobs,
            candidates: row.candidates,
            interviews: row.interviews,
            offers: row.offers,
            hires: row.hires,
            acceptanceRate: row.acceptanceRate,
            avgTimeToHire: row.avgTimeToHire ?? "—",
          })),
          filters.search,
          ["recruiterEmail"]
        ),
      },
      {
        id: "department-hiring",
        title: "Department Hiring",
        columns: [
          { key: "department", label: "Department" },
          { key: "openPositions", label: "Open" },
          { key: "filledPositions", label: "Filled" },
          { key: "offers", label: "Offers" },
          { key: "acceptanceRate", label: "Accept %" },
        ],
        rows: applySearch(
          department.map((row) => ({ id: row.department, ...row })),
          filters.search,
          ["department"]
        ),
      },
      {
        id: "time-in-stage",
        title: "Time To Hire",
        columns: [
          { key: "metric", label: "Metric" },
          { key: "days", label: "Days" },
        ],
        rows:
          time.sampleSize === 0
            ? []
            : [
                {
                  id: "applicationToInterview",
                  metric: "Application → Interview",
                  days: time.applicationToInterview ?? "—",
                },
                {
                  id: "interviewToOffer",
                  metric: "Interview → Offer",
                  days: time.interviewToOffer ?? "—",
                },
                {
                  id: "offerToHire",
                  metric: "Offer Accepted → Hire",
                  days: time.offerToHire ?? "—",
                },
                {
                  id: "totalTimeToHire",
                  metric: "Total Time To Hire",
                  days: time.totalTimeToHire ?? "—",
                },
              ],
      },
      {
        id: "candidate-sources",
        title: "Candidate Sources",
        columns: [
          { key: "source", label: "Source" },
          { key: "applications", label: "Applications" },
          { key: "interviews", label: "Interviews" },
          { key: "offers", label: "Offers" },
          { key: "hires", label: "Hires" },
          { key: "conversionRate", label: "Conversion %" },
        ],
        rows: applySearch(
          sources.map((row) => ({ id: row.source, ...row })),
          filters.search,
          ["source"]
        ),
      },
    ];

    return {
      section,
      title: "Hiring Reports",
      description: "Funnel, recruiter performance, departments, sources, and time metrics.",
      generatedAt,
      filters,
      kpis: [
        { label: "Open jobs", value: kpis.totalOpenJobs },
        { label: "Active candidates", value: kpis.activeCandidates },
        { label: "Applications", value: kpis.totalApplications },
        ...(kpis.avgTimeToHire != null
          ? [{ label: "Avg time to hire", value: `${kpis.avgTimeToHire}d` }]
          : []),
        { label: "Stuck candidates", value: pipeline.stuckCandidates },
      ],
      charts,
      tables,
    };
  }

  if (section === "interviews") {
    const interview = await getInterviewAnalyticsCached(session, analyticsFilters);
    return {
      section,
      title: "Interview Summary",
      description: "Interview volume, outcomes, and feedback quality.",
      generatedAt,
      filters,
      kpis: [
        { label: "Upcoming", value: interview.upcoming },
        { label: "Completed", value: interview.completed },
        { label: "Cancelled", value: interview.cancelled },
        { label: "No-show", value: interview.noShow },
        { label: "Avg feedback", value: interview.avgFeedbackScore },
      ],
      charts: [
        {
          id: "interview-outcomes",
          title: "Interview Outcomes",
          kind: "pie",
          labels: ["Upcoming", "Completed", "Cancelled", "No-show"],
          series: [
            {
              label: "Count",
              values: [
                interview.upcoming,
                interview.completed,
                interview.cancelled,
                interview.noShow,
              ],
            },
          ],
        },
      ],
      tables: [
        {
          id: "interview-summary",
          title: "Interview Summary",
          columns: [
            { key: "metric", label: "Metric" },
            { key: "value", label: "Value" },
          ],
          rows: [
            { id: "upcoming", metric: "Upcoming", value: interview.upcoming },
            { id: "completed", metric: "Completed", value: interview.completed },
            { id: "cancelled", metric: "Cancelled", value: interview.cancelled },
            { id: "noShow", metric: "No-show", value: interview.noShow },
            {
              id: "avgFeedbackScore",
              metric: "Avg feedback score",
              value: interview.avgFeedbackScore,
            },
          ],
        },
      ],
    };
  }

  if (section === "offers") {
    const offers = await getOfferAnalyticsCached(session, analyticsFilters);
    return {
      section,
      title: "Offer Summary",
      description: "Offer pipeline outcomes and revision pressure.",
      generatedAt,
      filters,
      kpis: [
        { label: "Sent", value: offers.sent },
        { label: "Accepted", value: offers.accepted },
        { label: "Declined", value: offers.declined },
        { label: "Expired", value: offers.expired },
        { label: "Withdrawn", value: offers.withdrawn },
      ],
      charts: [
        {
          id: "offer-outcomes",
          title: "Offer Outcomes",
          kind: "bar",
          labels: ["Sent", "Accepted", "Declined", "Expired", "Withdrawn"],
          series: [
            {
              label: "Count",
              values: [
                offers.sent,
                offers.accepted,
                offers.declined,
                offers.expired,
                offers.withdrawn,
              ],
              color: "#16a34a",
            },
          ],
        },
      ],
      tables: [
        {
          id: "offer-summary",
          title: "Offer Summary",
          columns: [
            { key: "metric", label: "Metric" },
            { key: "value", label: "Value" },
          ],
          rows: [
            { id: "sent", metric: "Sent", value: offers.sent },
            { id: "accepted", metric: "Accepted", value: offers.accepted },
            { id: "declined", metric: "Declined", value: offers.declined },
            { id: "expired", metric: "Expired", value: offers.expired },
            { id: "withdrawn", metric: "Withdrawn", value: offers.withdrawn },
            {
              id: "avgRevisionCount",
              metric: "Avg revisions",
              value: offers.avgRevisionCount,
            },
          ],
        },
      ],
    };
  }

  if (section === "conversions") {
    const [conversion, kpis] = await Promise.all([
      getConversionDashboardMetricsCached(session),
      getExecutiveKPIsCached(session, analyticsFilters),
    ]);
    return {
      section,
      title: "Conversion Summary",
      description: "Offer-to-employee conversion outcomes.",
      generatedAt,
      filters,
      kpis: [
        { label: "Offers accepted", value: conversion.offersAccepted },
        { label: "Employees joined", value: conversion.employeesJoined },
        { label: "Pending conversions", value: conversion.pendingConversions },
        { label: "Conversion rate", value: `${conversion.conversionRate}%` },
      ],
      charts: [
        {
          id: "conversion-funnel",
          title: "Conversion Funnel",
          kind: "bar",
          labels: ["Offers accepted", "Pending", "Joined"],
          series: [
            {
              label: "Count",
              values: [
                conversion.offersAccepted,
                conversion.pendingConversions,
                conversion.employeesJoined,
              ],
              color: "#7c3aed",
            },
          ],
        },
      ],
      tables: [
        {
          id: "conversion-summary",
          title: "Conversion Summary",
          columns: [
            { key: "metric", label: "Metric" },
            { key: "value", label: "Value" },
          ],
          rows: [
            {
              id: "offersAccepted",
              metric: "Offers accepted",
              value: conversion.offersAccepted,
            },
            {
              id: "pendingConversions",
              metric: "Pending conversions",
              value: conversion.pendingConversions,
            },
            {
              id: "employeesJoined",
              metric: "Employees joined",
              value: conversion.employeesJoined,
            },
            {
              id: "conversionRate",
              metric: "Conversion rate %",
              value: conversion.conversionRate,
            },
            {
              id: "executiveJoined",
              metric: "Executive employees joined",
              value: kpis.employeesJoined,
            },
          ],
        },
      ],
    };
  }

  const comm = await getCommunicationAnalyticsCached(session);
  return {
    section: "communications",
    title: "Communication Summary",
    description: "Email volume, drafts, templates, and recruiter messaging.",
    generatedAt,
    filters,
    kpis: [
      { label: "Emails sent", value: comm.emailsSent },
      { label: "Replies", value: comm.replies },
      { label: "Drafts", value: comm.draftCount },
      { label: "Scheduled", value: comm.scheduledCount },
    ],
    charts: [
      {
        id: "comm-volume",
        title: "Communication Volume",
        kind: "bar",
        labels: ["Sent", "Replies", "Drafts", "Scheduled", "Failed"],
        series: [
          {
            label: "Count",
            values: [
              comm.emailsSent,
              comm.replies,
              comm.draftCount,
              comm.scheduledCount,
              comm.failedCount,
            ],
            color: "#0e7490",
          },
        ],
      },
      {
        id: "template-usage",
        title: "Template Usage",
        kind: "pie",
        labels: comm.templateUsage.map((row) => row.templateName),
        series: [
          {
            label: "Uses",
            values: comm.templateUsage.map((row) => row.count),
          },
        ],
      },
    ],
    tables: [
      {
        id: "template-usage-table",
        title: "Templates Usage",
        columns: [
          { key: "templateName", label: "Template" },
          { key: "count", label: "Uses" },
        ],
        rows: applySearch(
          comm.templateUsage.map((row) => ({
            id: row.templateId,
            templateName: row.templateName,
            count: row.count,
          })),
          filters.search,
          ["templateName"]
        ),
      },
      {
        id: "messages-by-recruiter",
        title: "Messages by Recruiter",
        columns: [
          { key: "senderEmail", label: "Recruiter" },
          { key: "count", label: "Messages" },
        ],
        rows: applySearch(
          comm.messagesByRecruiter.map((row) => ({
            id: row.senderUserId,
            senderEmail: row.senderEmail ?? row.senderUserId,
            count: row.count,
          })),
          filters.search,
          ["senderEmail"]
        ),
      },
    ],
  };
}
