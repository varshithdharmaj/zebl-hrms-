import { describe, expect, it } from "vitest";
import { RecruitmentPermissionService } from "@/lib/recruitment/permissions/permission-service";
import {
  redactCandidateCompensationFields,
  redactOfferCtc,
} from "@/lib/recruitment/candidate/workspace-compensation";
import { mapWorkspaceInterviewRow } from "@/lib/recruitment/candidate/workspace-interviews";
import { buildCandidateCreateApplicationHref } from "@/lib/recruitment/candidate/workspace-create-application-href";
import {
  buildApplicationCreateRedirect,
  buildRecruitmentEntityHref,
  isSafeRecruitmentReturnTo,
} from "@/lib/recruitment/navigation/return-to";
import type { SessionUser } from "@/lib/session";

function session(partial: Partial<SessionUser> & Pick<SessionUser, "role">): SessionUser {
  return {
    id: partial.id ?? "user-1",
    email: partial.email ?? "u@example.com",
    role: partial.role,
    employeeId: partial.employeeId ?? null,
    employeeName: partial.employeeName ?? "User",
    sessionVersion: partial.sessionVersion ?? 1,
    authProvider: partial.authProvider ?? "local",
    recruitmentOpsAccess: partial.recruitmentOpsAccess ?? false,
    mustChangePassword: false,
  };
}

describe("Phase 2A compensation RBAC", () => {
  it("allows recruitment administration regardless of HM flag", () => {
    expect(
      RecruitmentPermissionService.canViewCompensation(session({ role: "hr" }), false)
    ).toBe(true);
  });

  it("allows assigned hiring managers only when flagged", () => {
    const manager = session({
      role: "employee",
      employeeId: 10,
    });
    expect(RecruitmentPermissionService.canViewCompensation(manager, true)).toBe(true);
    expect(RecruitmentPermissionService.canViewCompensation(manager, false)).toBe(false);
  });

  it("redacts candidate CTC when unauthorized", () => {
    const candidate = {
      id: "c1",
      currentCtc: "1200000",
      expectedCtc: "1500000",
      fullName: "Varshith",
    };
    expect(redactCandidateCompensationFields(candidate, true).currentCtc).toBe("1200000");
    const redacted = redactCandidateCompensationFields(candidate, false);
    expect(redacted.currentCtc).toBeNull();
    expect(redacted.expectedCtc).toBeNull();
    expect(redacted.fullName).toBe("Varshith");
  });

  it("redacts offer CTC when unauthorized", () => {
    expect(redactOfferCtc(2500000, true)).toBe(2500000);
    expect(redactOfferCtc(2500000, false)).toBeNull();
  });
});

describe("Phase 2A interview application/job attribution", () => {
  it("maps each interview to its own application job title", () => {
    const interviewA = mapWorkspaceInterviewRow({
      id: "int-a",
      title: "Technical Round",
      scheduledStart: new Date("2026-08-10T10:00:00Z"),
      roundType: "technical",
      status: "scheduled",
      application: {
        id: "app-a",
        jobOpeningId: "job-a",
        jobOpening: { id: "job-a", title: "Senior Software Engineer" },
      },
    });
    const interviewB = mapWorkspaceInterviewRow({
      id: "int-b",
      title: "Screening Call",
      scheduledStart: new Date("2026-08-11T10:00:00Z"),
      roundType: "screening",
      status: "scheduled",
      application: {
        id: "app-b",
        jobOpeningId: "job-b",
        jobOpening: { id: "job-b", title: "Backend Engineer" },
      },
    });

    expect(interviewA.jobTitle).toBe("Senior Software Engineer");
    expect(interviewA.applicationId).toBe("app-a");
    expect(interviewB.jobTitle).toBe("Backend Engineer");
    expect(interviewB.applicationId).toBe("app-b");
    expect(interviewA.jobTitle).not.toBe(interviewB.jobTitle);
  });

  it("does not invent a job title when application context is missing", () => {
    const orphan = mapWorkspaceInterviewRow({
      id: "int-x",
      title: "Orphan",
      scheduledStart: new Date("2026-08-12T10:00:00Z"),
      roundType: "final",
      status: "scheduled",
      application: null,
    });
    expect(orphan.jobTitle).toBeNull();
    expect(orphan.applicationId).toBeNull();
  });
});

describe("Phase 2A returnTo continuity", () => {
  it("builds Create Application href with validated candidate returnTo", () => {
    const href = buildCandidateCreateApplicationHref({
      candidateId: "cand-1",
      returnTo: "/admin/recruitment/candidates/cand-1?tab=applications",
    });
    expect(href).toContain("/admin/recruitment/applications/new?");
    expect(href).toContain("candidateId=cand-1");
    expect(href).toContain(
      `returnTo=${encodeURIComponent("/admin/recruitment/candidates/cand-1?tab=applications")}`
    );
  });

  it("rejects unsafe returnTo on Create Application and falls back to candidate", () => {
    const href = buildCandidateCreateApplicationHref({
      candidateId: "cand-1",
      returnTo: "https://evil.example",
    });
    expect(href).toContain("candidateId=cand-1");
    expect(href).toContain(
      `returnTo=${encodeURIComponent("/admin/recruitment/candidates/cand-1")}`
    );
    expect(href).not.toContain("evil");
  });

  it("forwards returnTo onto Pipeline after application create", () => {
    const redirect = buildApplicationCreateRedirect({
      applicationId: "app-99",
      jobOpeningId: "job-2",
      returnTo: "/admin/recruitment/candidates/cand-1",
    });
    expect(redirect).toContain("applicationId=app-99");
    expect(redirect).toContain("jobOpeningId=job-2");
    expect(redirect).toContain(
      `returnTo=${encodeURIComponent("/admin/recruitment/candidates/cand-1")}`
    );
    expect(isSafeRecruitmentReturnTo("/admin/recruitment/candidates/cand-1")).toBe(true);
  });

  it("builds Interview and Offer hrefs with Application returnTo", () => {
    const interviewHref = buildRecruitmentEntityHref("/admin/recruitment/interviews/int-1", {
      returnTo: "/admin/recruitment/applications/app-a",
    });
    const offerHref = buildRecruitmentEntityHref("/admin/recruitment/offers/off-1", {
      returnTo: "/admin/recruitment/applications/app-a",
    });
    expect(interviewHref).toContain("returnTo=");
    expect(interviewHref).toContain(encodeURIComponent("/admin/recruitment/applications/app-a"));
    expect(offerHref).toContain(encodeURIComponent("/admin/recruitment/applications/app-a"));
  });
});
