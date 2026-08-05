import { describe, expect, it } from "vitest";
import { RecruitmentEventFactory } from "@/lib/recruitment/events/factory";
import { listRecruitmentEventConsumers } from "@/lib/recruitment/events/registry";
import { normalizePagination, toPageResult } from "@/lib/recruitment/shared/pagination";
import type { RecruitmentActor } from "@/lib/recruitment/types/actor";

const actor: RecruitmentActor = {
  userId: "u1",
  email: "a@example.com",
  role: "hr",
  employeeId: 1,
};

describe("recruitment shared helpers + event factory", () => {
  it("normalizes pagination bounds", () => {
    expect(normalizePagination({})).toEqual({ page: 1, pageSize: 25 });
    expect(normalizePagination({ page: 0, pageSize: 999 })).toEqual({
      page: 1,
      pageSize: 50,
    });
  });

  it("builds page results", () => {
    const result = toPageResult(["a", "b"], 12, { page: 1, pageSize: 10 });
    expect(result.totalPages).toBe(2);
    expect(result.items).toHaveLength(2);
  });

  it("creates typed ApplicationCreated events", () => {
    const event = RecruitmentEventFactory.applicationCreated(actor, {
      applicationId: "app-1",
      candidateId: "cand-1",
      jobOpeningId: "job-1",
    });
    expect(event.type).toBe("ApplicationCreated");
    expect(event.eventId).toBeTruthy();
    if (event.type === "ApplicationCreated") {
      expect(event.payload.applicationId).toBe("app-1");
    }
  });

  it("registers built-in consumers", () => {
    const names = listRecruitmentEventConsumers().map((c) => c.name);
    expect(names).toEqual(
      expect.arrayContaining(["audit", "notification", "timeline", "analytics"])
    );
  });
});
