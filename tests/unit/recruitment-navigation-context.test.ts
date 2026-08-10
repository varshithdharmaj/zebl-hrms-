import { describe, expect, it } from "vitest";
import { isSidebarNavActive } from "@/lib/recruitment/navigation/sidebar-nav-active";
import {
  buildApplicationCreateRedirect,
  buildPipelineHref,
  isSafeRecruitmentReturnTo,
  resolveRecruitmentReturnTo,
} from "@/lib/recruitment/navigation/return-to";
import {
  buildRecruitmentBreadcrumbs,
  formatRecruitmentEnumLabel,
} from "@/lib/recruitment/navigation/breadcrumbs";

const HIRING_HREFS = [
  "/admin/recruitment",
  "/admin/recruitment/jobs",
  "/admin/recruitment/candidates",
  "/admin/recruitment/pipeline",
  "/admin/recruitment/interviews",
  "/admin/recruitment/offers",
  "/admin/recruitment/conversions",
  "/admin/recruitment/reports",
] as const;

describe("sidebar nav active matching", () => {
  it("activates dashboard only on the exact recruitment root", () => {
    expect(isSidebarNavActive("/admin/recruitment", "/admin/recruitment", HIRING_HREFS)).toBe(
      true
    );
    expect(
      isSidebarNavActive("/admin/recruitment/jobs", "/admin/recruitment", HIRING_HREFS)
    ).toBe(false);
    expect(
      isSidebarNavActive("/admin/recruitment/pipeline", "/admin/recruitment", HIRING_HREFS)
    ).toBe(false);
    expect(
      isSidebarNavActive("/admin/recruitment/interviews", "/admin/recruitment", HIRING_HREFS)
    ).toBe(false);
    expect(
      isSidebarNavActive("/admin/recruitment/offers", "/admin/recruitment", HIRING_HREFS)
    ).toBe(false);
    expect(
      isSidebarNavActive("/admin/recruitment/conversions", "/admin/recruitment", HIRING_HREFS)
    ).toBe(false);
    expect(
      isSidebarNavActive("/admin/recruitment/reports", "/admin/recruitment", HIRING_HREFS)
    ).toBe(false);
  });

  it("activates child sections including nested detail routes", () => {
    expect(
      isSidebarNavActive("/admin/recruitment/jobs/job-1", "/admin/recruitment/jobs", HIRING_HREFS)
    ).toBe(true);
    expect(
      isSidebarNavActive(
        "/admin/recruitment/candidates/c1",
        "/admin/recruitment/candidates",
        HIRING_HREFS
      )
    ).toBe(true);
    expect(
      isSidebarNavActive(
        "/admin/recruitment/interviews/i1",
        "/admin/recruitment/interviews",
        HIRING_HREFS
      )
    ).toBe(true);
    expect(
      isSidebarNavActive("/admin/recruitment/offers/o1/edit", "/admin/recruitment/offers", HIRING_HREFS)
    ).toBe(true);
    expect(
      isSidebarNavActive(
        "/admin/recruitment/conversions/off-1",
        "/admin/recruitment/conversions",
        HIRING_HREFS
      )
    ).toBe(true);
    expect(
      isSidebarNavActive(
        "/admin/recruitment/reports/hiring",
        "/admin/recruitment/reports",
        HIRING_HREFS
      )
    ).toBe(true);
  });

  it("treats application routes as pipeline, not dashboard", () => {
    expect(
      isSidebarNavActive(
        "/admin/recruitment/applications/app-1",
        "/admin/recruitment/pipeline",
        HIRING_HREFS
      )
    ).toBe(true);
    expect(
      isSidebarNavActive(
        "/admin/recruitment/applications/app-1",
        "/admin/recruitment",
        HIRING_HREFS
      )
    ).toBe(false);
  });

  it("never marks two hiring items active for the same path", () => {
    const paths = [
      "/admin/recruitment",
      "/admin/recruitment/jobs",
      "/admin/recruitment/candidates",
      "/admin/recruitment/pipeline",
      "/admin/recruitment/interviews",
      "/admin/recruitment/offers",
      "/admin/recruitment/conversions",
      "/admin/recruitment/reports",
    ];
    for (const path of paths) {
      const activeCount = HIRING_HREFS.filter((href) =>
        isSidebarNavActive(path, href, HIRING_HREFS)
      ).length;
      expect(activeCount).toBe(1);
    }
  });
});

describe("returnTo validation", () => {
  it("accepts internal recruitment paths", () => {
    expect(
      isSafeRecruitmentReturnTo(
        "/admin/recruitment/pipeline?applicationId=a1&jobOpeningId=j1"
      )
    ).toBe(true);
  });

  it("rejects open redirects and traversal", () => {
    expect(isSafeRecruitmentReturnTo("https://evil.example/phish")).toBe(false);
    expect(isSafeRecruitmentReturnTo("//evil.example")).toBe(false);
    expect(isSafeRecruitmentReturnTo("/admin/employees/1")).toBe(false);
    expect(isSafeRecruitmentReturnTo("/admin/recruitment/pipeline/../settings")).toBe(
      false
    );
    expect(isSafeRecruitmentReturnTo("/admin/recruitment/pipeline\n/x")).toBe(false);
  });

  it("falls back when returnTo is unsafe", () => {
    expect(resolveRecruitmentReturnTo("//evil", "/admin/recruitment/pipeline")).toBe(
      "/admin/recruitment/pipeline"
    );
  });
});

describe("application create redirect", () => {
  it("opens pipeline with the created application selected", () => {
    expect(
      buildApplicationCreateRedirect({
        applicationId: "app-99",
        jobOpeningId: "job-2",
      })
    ).toBe("/admin/recruitment/pipeline?jobOpeningId=job-2&applicationId=app-99");
    expect(buildPipelineHref({ applicationId: "app-1" })).toBe(
      "/admin/recruitment/pipeline?applicationId=app-1"
    );
  });
});

describe("recruitment breadcrumbs", () => {
  it("builds candidate → application trail", () => {
    const crumbs = buildRecruitmentBreadcrumbs({
      section: "applications",
      candidate: { id: "c1", name: "Rahul" },
      job: { id: "j1", title: "Senior Software Engineer" },
      application: { id: "a1", jobTitle: "Senior Software Engineer" },
    });
    expect(crumbs.map((c) => c.label)).toEqual([
      "Recruitment",
      "Candidates",
      "Rahul",
      "Application: Senior Software Engineer",
    ]);
    expect(crumbs.at(-1)?.href).toBeUndefined();
    expect(crumbs[2]?.href).toContain("/candidates/c1");
  });

  it("builds pipeline return trail from returnTo", () => {
    const crumbs = buildRecruitmentBreadcrumbs({
      section: "candidates",
      returnTo: "/admin/recruitment/pipeline?jobOpeningId=j1&applicationId=a1",
      candidate: { id: "c1", name: "Rahul" },
      job: { id: "j1", title: "Senior Software Engineer" },
      application: { id: "a1", jobTitle: "Senior Software Engineer" },
    });
    expect(crumbs[1]?.label).toBe("Pipeline");
    expect(crumbs[1]?.href).toContain("/pipeline");
  });

  it("formats stage labels without relying on color", () => {
    expect(formatRecruitmentEnumLabel("technical_round")).toBe("Technical Round");
  });
});
