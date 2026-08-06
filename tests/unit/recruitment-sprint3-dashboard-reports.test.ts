import { describe, expect, it } from "vitest";
import {
  buildHiringFunnelCounts,
  FUNNEL_LABELS,
} from "@/lib/recruitment/dashboard/build-funnel-counts";
import {
  computeTimeToHireMetrics,
  dayDelta,
} from "@/lib/recruitment/analytics/compute-time-to-hire";
import {
  normalizePagination,
  normalizePipelineBoardTake,
  PIPELINE_BOARD_MAX_ITEMS,
  PIPELINE_BOARD_PAGE_SIZE,
} from "@/lib/recruitment/shared/pagination";
import { getLast7DaysRange, toDateInputValue } from "@/lib/recruitment/reports/default-date-range";
import { toReportFilters } from "@/lib/recruitment/reports/parse-filters";

describe("buildHiringFunnelCounts", () => {
  it("maps stage counts into funnel buckets", () => {
    const funnel = buildHiringFunnelCounts({
      stageCounts: {
        stage_resume_received: 12,
        stage_screening: 4,
        stage_assessment: 2,
        stage_hr_round: 3,
        stage_technical_round: 5,
        stage_decision: 2,
        stage_offer: 1,
        stage_hired: 6,
      },
      offerSent: 8,
      offerAccepted: 5,
      pendingConversion: 3,
    });

    expect(funnel).toEqual({
      applied: 12,
      screening: 6,
      interview: 8,
      selected: 2,
      offerSent: 8,
      offerAccepted: 5,
      pendingConversion: 3,
      hired: 6,
    });
  });

  it("falls back to stage_offer for offerSent when not provided", () => {
    const funnel = buildHiringFunnelCounts({
      stageCounts: { stage_offer: 4, stage_hired: 1 },
    });
    expect(funnel.offerSent).toBe(4);
    expect(funnel.offerAccepted).toBe(0);
    expect(funnel.pendingConversion).toBe(0);
  });

  it("exposes ordered funnel labels for the widget", () => {
    expect(FUNNEL_LABELS.map((l) => l.label)).toEqual([
      "Applied",
      "Screening",
      "Interview",
      "Selected",
      "Offer Sent",
      "Offer Accepted",
      "Pending Conversion",
      "Hired",
    ]);
  });
});

describe("computeTimeToHireMetrics", () => {
  it("returns nulls when there are no conversions", () => {
    expect(computeTimeToHireMetrics([])).toEqual({
      applicationToInterview: null,
      interviewToOffer: null,
      offerToHire: null,
      totalTimeToHire: null,
      sampleSize: 0,
    });
  });

  it("calculates total TTH from application created → converted", () => {
    const applied = new Date("2026-01-01T00:00:00.000Z");
    const converted = new Date("2026-01-21T00:00:00.000Z");
    const metrics = computeTimeToHireMetrics([
      {
        applicationCreatedAt: applied,
        convertedAt: converted,
        firstInterviewAt: null,
        offerSentAt: null,
        offerAcceptedAt: null,
      },
    ]);
    expect(metrics.sampleSize).toBe(1);
    expect(metrics.totalTimeToHire).toBe(20);
    expect(metrics.applicationToInterview).toBeNull();
    expect(metrics.interviewToOffer).toBeNull();
    expect(metrics.offerToHire).toBeNull();
  });

  it("averages segments across conversions", () => {
    const metrics = computeTimeToHireMetrics([
      {
        applicationCreatedAt: new Date("2026-01-01T00:00:00.000Z"),
        firstInterviewAt: new Date("2026-01-06T00:00:00.000Z"),
        offerSentAt: new Date("2026-01-11T00:00:00.000Z"),
        offerAcceptedAt: new Date("2026-01-13T00:00:00.000Z"),
        convertedAt: new Date("2026-01-16T00:00:00.000Z"),
      },
      {
        applicationCreatedAt: new Date("2026-02-01T00:00:00.000Z"),
        firstInterviewAt: new Date("2026-02-11T00:00:00.000Z"),
        offerSentAt: new Date("2026-02-21T00:00:00.000Z"),
        offerAcceptedAt: new Date("2026-02-23T00:00:00.000Z"),
        convertedAt: new Date("2026-02-28T00:00:00.000Z"),
      },
    ]);

    expect(metrics.sampleSize).toBe(2);
    expect(metrics.applicationToInterview).toBe(Math.round((5 + 10) / 2));
    expect(metrics.interviewToOffer).toBe(Math.round((5 + 10) / 2));
    expect(metrics.offerToHire).toBe(Math.round((3 + 5) / 2));
    expect(metrics.totalTimeToHire).toBe(Math.round((15 + 27) / 2));
  });

  it("dayDelta never goes negative", () => {
    expect(
      dayDelta(new Date("2026-01-10T00:00:00.000Z"), new Date("2026-01-05T00:00:00.000Z"))
    ).toBe(0);
  });
});

describe("pipeline board pagination", () => {
  it("grows take by page and caps at max", () => {
    expect(normalizePipelineBoardTake(1)).toEqual({
      page: 1,
      pageSize: PIPELINE_BOARD_PAGE_SIZE,
      take: 50,
      hasMoreCapacity: true,
    });
    expect(normalizePipelineBoardTake(2).take).toBe(100);
    expect(normalizePipelineBoardTake(4).take).toBe(PIPELINE_BOARD_MAX_ITEMS);
    expect(normalizePipelineBoardTake(4).hasMoreCapacity).toBe(false);
    expect(normalizePipelineBoardTake(99).take).toBe(PIPELINE_BOARD_MAX_ITEMS);
  });

  it("allows raising max page size for board loads", () => {
    const pagination = normalizePagination(
      { page: 1, pageSize: 150 },
      { maxPageSize: PIPELINE_BOARD_MAX_ITEMS }
    );
    expect(pagination.pageSize).toBe(150);
    expect(normalizePagination({ page: 1, pageSize: 500 }).pageSize).toBe(50);
  });
});

describe("report default date range", () => {
  it("defaults to last 7 days inclusive of today", () => {
    const now = new Date("2026-08-06T15:00:00.000Z");
    const { startDate, endDate } = getLast7DaysRange(now);
    expect(toDateInputValue(startDate)).toBe("2026-07-31");
    expect(toDateInputValue(endDate)).toBe("2026-08-06");
  });

  it("toReportFilters defaults dateRange and days to 7", () => {
    const filters = toReportFilters({});
    expect(filters.days).toBe(7);
    expect(filters.dateRange?.startDate).toBeInstanceOf(Date);
    expect(filters.dateRange?.endDate).toBeInstanceOf(Date);
    const spanMs =
      (filters.dateRange!.endDate!.getTime() - filters.dateRange!.startDate!.getTime()) /
      (1000 * 60 * 60 * 24);
    expect(spanMs).toBeGreaterThanOrEqual(6);
    expect(spanMs).toBeLessThan(8);
  });
});

describe("offer summary status buckets", () => {
  it("documents the six trusted offer statuses for dashboard/reports", () => {
    const statuses = ["draft", "sent", "accepted", "declined", "withdrawn", "expired"] as const;
    const counts = Object.fromEntries(statuses.map((s) => [s, 0])) as Record<
      (typeof statuses)[number],
      number
    >;
    counts.draft = 2;
    counts.sent = 5;
    counts.accepted = 3;
    counts.declined = 1;
    counts.withdrawn = 1;
    counts.expired = 2;
    expect(Object.keys(counts)).toHaveLength(6);
    expect(counts.sent + counts.expired).toBe(7);
  });
});
