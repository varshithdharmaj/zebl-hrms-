import { describe, expect, it, vi, beforeEach } from "vitest";
import { NotificationType } from "@/generated/prisma/enums";

const enqueueNotification = vi.fn(async () => "notif-1");
const getHrRecipients = vi.fn(async () => [{ email: "hr-fallback@example.com", userId: "hr-1" }]);
const userFindUnique = vi.fn(async () => null as { id: string; email: string } | null);

vi.mock("@/lib/notifications/notification-queue", () => ({
  enqueueNotification: (...args: unknown[]) => enqueueNotification(...args),
}));
vi.mock("@/lib/notifications/recipient-resolver", () => ({
  getHrRecipients: (...args: unknown[]) => getHrRecipients(...args),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: (...args: unknown[]) => userFindUnique(...args) } },
}));
vi.mock("@/lib/config/app-url", () => ({
  getAppBaseUrl: () => "https://ams.example.com",
}));

import {
  queueCandidateConfirmation,
  queueHrPublicApplicationAlert,
} from "@/lib/recruitment/public-apply/notifications";

describe("public-apply notifications", () => {
  beforeEach(() => {
    enqueueNotification.mockClear();
    getHrRecipients.mockClear();
    userFindUnique.mockClear();
  });

  describe("queueCandidateConfirmation", () => {
    it("queues an email addressed to the candidate with only candidate-safe fields", async () => {
      await queueCandidateConfirmation({
        candidateEmail: "jane@example.com",
        candidateName: "Jane Doe",
        jobTitle: "Backend Engineer",
        referenceCode: "ABC12345",
      });

      expect(enqueueNotification).toHaveBeenCalledTimes(1);
      const call = enqueueNotification.mock.calls[0][0] as Record<string, unknown>;
      expect(call.type).toBe(NotificationType.recruitment_public_application_received);
      expect(call.recipient).toBe("jane@example.com");
      const payload = call.payload as Record<string, unknown>;
      expect(payload.candidateName).toBe("Jane Doe");
      expect(payload.jobTitle).toBe("Backend Engineer");
      expect(payload.referenceCode).toBe("ABC12345");
      // Never expose internal ids, pipeline stage, or HR-only fields.
      expect(payload).not.toHaveProperty("candidateId");
      expect(payload).not.toHaveProperty("applicationId");
      expect(payload).not.toHaveProperty("currentStage");
      expect(payload).not.toHaveProperty("compensation");
    });

    it("sanitizes candidate-provided text before it reaches the email payload", async () => {
      await queueCandidateConfirmation({
        candidateEmail: "jane@example.com",
        candidateName: "<script>alert(1)</script>Jane",
        jobTitle: "Engineer",
        referenceCode: "REF1",
      });
      const payload = enqueueNotification.mock.calls[0][0].payload as Record<string, unknown>;
      expect(payload.candidateName).not.toContain("<script>");
    });

    it("never throws — a notification failure must not affect the caller", async () => {
      enqueueNotification.mockRejectedValueOnce(new Error("queue down"));
      await expect(
        queueCandidateConfirmation({
          candidateEmail: "jane@example.com",
          candidateName: "Jane",
          jobTitle: "Engineer",
          referenceCode: "REF1",
        })
      ).resolves.toBeUndefined();
    });
  });

  describe("queueHrPublicApplicationAlert", () => {
    it("targets the job's owning recruiter when one is assigned", async () => {
      userFindUnique.mockResolvedValueOnce({ id: "user-owner", email: "owner@example.com" });

      await queueHrPublicApplicationAlert({
        ownerRecruiterUserId: "user-owner",
        candidateName: "Jane Doe",
        jobTitle: "Backend Engineer",
        applicationId: "app-1",
        referenceCode: "ABC12345",
      });

      expect(getHrRecipients).not.toHaveBeenCalled();
      expect(enqueueNotification).toHaveBeenCalledTimes(1);
      const call = enqueueNotification.mock.calls[0][0] as Record<string, unknown>;
      expect(call.type).toBe(NotificationType.recruitment_public_application_hr_alert);
      expect(call.recipient).toBe("owner@example.com");
      const payload = call.payload as Record<string, unknown>;
      expect(payload.source).toBe("Public application");
      expect(payload.applicationUrl).toBe("https://ams.example.com/admin/recruitment/applications/app-1");
    });

    it("falls back to getHrRecipients() when no owner is assigned", async () => {
      await queueHrPublicApplicationAlert({
        ownerRecruiterUserId: null,
        candidateName: "Jane Doe",
        jobTitle: "Backend Engineer",
        applicationId: "app-1",
        referenceCode: "ABC12345",
      });

      expect(getHrRecipients).toHaveBeenCalledTimes(1);
      expect(enqueueNotification).toHaveBeenCalledTimes(1);
      expect(enqueueNotification.mock.calls[0][0].recipient).toBe("hr-fallback@example.com");
    });

    it("falls back to getHrRecipients() when the assigned owner no longer exists", async () => {
      userFindUnique.mockResolvedValueOnce(null);
      await queueHrPublicApplicationAlert({
        ownerRecruiterUserId: "user-deleted",
        candidateName: "Jane Doe",
        jobTitle: "Backend Engineer",
        applicationId: "app-1",
        referenceCode: "ABC12345",
      });
      expect(getHrRecipients).toHaveBeenCalledTimes(1);
    });

    it("links to the existing session-gated Application page, never a public URL", async () => {
      await queueHrPublicApplicationAlert({
        ownerRecruiterUserId: null,
        candidateName: "Jane Doe",
        jobTitle: "Backend Engineer",
        applicationId: "app-1",
        referenceCode: "ABC12345",
      });
      const payload = enqueueNotification.mock.calls[0][0].payload as Record<string, unknown>;
      expect(payload.applicationUrl).toMatch(/^https:\/\/ams\.example\.com\/admin\/recruitment\/applications\//);
    });

    it("never throws — a notification failure must not affect the caller", async () => {
      getHrRecipients.mockRejectedValueOnce(new Error("db down"));
      await expect(
        queueHrPublicApplicationAlert({
          ownerRecruiterUserId: null,
          candidateName: "Jane",
          jobTitle: "Engineer",
          applicationId: "app-1",
          referenceCode: "REF1",
        })
      ).resolves.toBeUndefined();
    });
  });
});
