import { describe, expect, it } from "vitest";
import { PublicSubmissionStatus } from "@/generated/prisma/enums";
import { ALLOWED_TRANSITIONS, isTransitionAllowed, TERMINAL_STATUSES } from "@/lib/recruitment/public-apply/types";

const ALL_STATUSES = Object.values(PublicSubmissionStatus);

describe("public-apply state machine", () => {
  it("has an explicit entry for every PublicSubmissionStatus value", () => {
    for (const status of ALL_STATUSES) {
      expect(ALLOWED_TRANSITIONS).toHaveProperty(status);
    }
  });

  it("allows the documented happy path", () => {
    expect(isTransitionAllowed("started", "basic_info_complete")).toBe(true);
    expect(isTransitionAllowed("basic_info_complete", "resume_uploaded")).toBe(true);
    expect(isTransitionAllowed("resume_uploaded", "parsing")).toBe(true);
    expect(isTransitionAllowed("parsing", "ready_for_review")).toBe(true);
    expect(isTransitionAllowed("ready_for_review", "candidate_edited")).toBe(true);
    expect(isTransitionAllowed("candidate_edited", "submitted")).toBe(true);
  });

  it("allows accept-parsed-as-is without editing", () => {
    expect(isTransitionAllowed("ready_for_review", "submitted")).toBe(true);
  });

  it("allows parse-failure manual-entry recovery", () => {
    expect(isTransitionAllowed("parsing", "parse_failed")).toBe(true);
    expect(isTransitionAllowed("parse_failed", "candidate_edited")).toBe(true);
    expect(isTransitionAllowed("parse_failed", "parsing")).toBe(true);
  });

  it("rejects skipping straight from started to submitted", () => {
    expect(isTransitionAllowed("started", "submitted")).toBe(false);
  });

  it("rejects any transition out of a terminal state", () => {
    for (const terminal of TERMINAL_STATUSES) {
      for (const target of ALL_STATUSES) {
        expect(isTransitionAllowed(terminal, target)).toBe(false);
      }
    }
  });

  it("rejects re-parsing after the candidate has started editing", () => {
    // A candidate who wants to swap resumes after editing must go through an
    // explicit reset, not a silent re-parse merge (see design §9).
    expect(isTransitionAllowed("candidate_edited", "parsing")).toBe(false);
    expect(isTransitionAllowed("candidate_edited", "resume_uploaded")).toBe(false);
  });

  it("allows retrying submit after a transient submission failure", () => {
    expect(isTransitionAllowed("submission_failed", "submitted")).toBe(true);
    expect(isTransitionAllowed("submission_failed", "candidate_edited")).toBe(true);
  });
});
