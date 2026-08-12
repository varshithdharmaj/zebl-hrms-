import { describe, expect, it } from "vitest";
import {
  buildCandidateWorkspaceTabHref,
  parseCandidateWorkspaceTab,
} from "@/lib/recruitment/candidate/workspace-tab";

describe("parseCandidateWorkspaceTab", () => {
  it("defaults to overview when tab is missing", () => {
    expect(parseCandidateWorkspaceTab({})).toBe("overview");
  });

  it("parses valid workspace tabs", () => {
    expect(parseCandidateWorkspaceTab({ tab: "applications" })).toBe("applications");
    expect(parseCandidateWorkspaceTab({ tab: "documents" })).toBe("documents");
    expect(parseCandidateWorkspaceTab({ tab: "activity" })).toBe("activity");
    expect(parseCandidateWorkspaceTab({ tab: "overview" })).toBe("overview");
  });

  it("falls back to overview for invalid tab values", () => {
    expect(parseCandidateWorkspaceTab({ tab: "invalid" })).toBe("overview");
    expect(parseCandidateWorkspaceTab({ tab: "" })).toBe("overview");
  });
});

describe("buildCandidateWorkspaceTabHref", () => {
  it("omits tab param for overview", () => {
    expect(
      buildCandidateWorkspaceTabHref(
        "/admin/recruitment/candidates/c1",
        { returnTo: "/admin/recruitment/pipeline", tab: "documents" },
        "overview"
      )
    ).toBe("/admin/recruitment/candidates/c1?returnTo=%2Fadmin%2Frecruitment%2Fpipeline");
  });

  it("sets tab param for non-overview tabs and preserves nav params", () => {
    expect(
      buildCandidateWorkspaceTabHref(
        "/admin/recruitment/candidates/c1",
        {
          returnTo: "/admin/recruitment/pipeline",
          applicationId: "app-1",
          jobOpeningId: "job-1",
        },
        "applications"
      )
    ).toBe(
      "/admin/recruitment/candidates/c1?returnTo=%2Fadmin%2Frecruitment%2Fpipeline&applicationId=app-1&jobOpeningId=job-1&tab=applications"
    );
  });
});
