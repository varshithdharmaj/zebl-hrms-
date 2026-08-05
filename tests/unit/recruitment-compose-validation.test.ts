import { describe, expect, it } from "vitest";
import {
  validateComposeForm,
  validateDraftEditable,
} from "@/components/recruitment/communications/compose/compose-validation";
import { EMPTY_VARIABLES } from "@/components/recruitment/communications/compose/compose-types";
import {
  mergeComposeTemplates,
  buildComposeRecipientOptions,
} from "@/components/recruitment/communications/compose/build-compose-options";
import { renderEmailContent } from "@/lib/recruitment/communication/template-renderer";
import { SYSTEM_EMAIL_TEMPLATES } from "@/lib/recruitment/communication/system-templates";

describe("compose validation", () => {
  it("rejects empty subject and body", () => {
    expect(
      validateComposeForm({
        draftId: null,
        subject: " ",
        body: "Hello",
        recipientEmail: "a@b.com",
        additionalRecipients: [],
        candidateId: null,
        applicationId: null,
        jobOpeningId: null,
        interviewId: null,
        offerId: null,
        templateId: null,
        systemTemplateId: null,
        variables: EMPTY_VARIABLES,
      }).ok
    ).toBe(false);

    expect(
      validateComposeForm({
        draftId: null,
        subject: "Hello",
        body: "",
        recipientEmail: "a@b.com",
        additionalRecipients: [],
        candidateId: null,
        applicationId: null,
        jobOpeningId: null,
        interviewId: null,
        offerId: null,
        templateId: null,
        systemTemplateId: null,
        variables: EMPTY_VARIABLES,
      }).ok
    ).toBe(false);
  });

  it("rejects invalid recipient email", () => {
    const result = validateComposeForm({
      draftId: null,
      subject: "Hello",
      body: "Body",
      recipientEmail: "not-an-email",
      additionalRecipients: [],
      candidateId: null,
      applicationId: null,
      jobOpeningId: null,
      interviewId: null,
      offerId: null,
      templateId: null,
      systemTemplateId: null,
      variables: EMPTY_VARIABLES,
    });
    expect(result.ok).toBe(false);
  });

  it("allows draft autosave without recipient", () => {
    const result = validateComposeForm(
      {
        draftId: null,
        subject: "Hello",
        body: "Body",
        recipientEmail: "",
        additionalRecipients: [],
        candidateId: null,
        applicationId: null,
        jobOpeningId: null,
        interviewId: null,
        offerId: null,
        templateId: null,
        systemTemplateId: null,
        variables: EMPTY_VARIABLES,
      },
      { requireRecipient: false }
    );
    expect(result.ok).toBe(true);
  });

  it("blocks editing non-draft communications", () => {
    expect(validateDraftEditable("sent").ok).toBe(false);
    expect(validateDraftEditable("draft").ok).toBe(true);
  });
});

describe("compose templates", () => {
  it("merges system templates with database templates", () => {
    const merged = mergeComposeTemplates([
      {
        id: "db-1",
        name: "Custom Follow-up",
        type: "general",
        subject: "Follow up",
        body: "Body",
        isSystem: false,
      },
    ]);
    expect(merged.some((template) => template.id.startsWith("system:"))).toBe(true);
    expect(merged.some((template) => template.id === "db-1")).toBe(true);
  });

  it("renders system interview invitation placeholders", () => {
    const template = SYSTEM_EMAIL_TEMPLATES[0];
    const rendered = renderEmailContent(template.subject, template.body, {
      candidateName: "Ada",
      jobTitle: "Engineer",
      company: "ZEBL",
      date: "Aug 10",
      time: "10:00 AM",
      location: "HQ",
      interviewer: "Grace",
    });
    expect(rendered.subject).toContain("Engineer");
    expect(rendered.body).toContain("Ada");
    expect(rendered.body).toContain("Grace");
  });

  it("builds recipient options from linked entities", () => {
    const options = buildComposeRecipientOptions({
      companyName: "ZEBL",
      candidates: [
        {
          id: "c1",
          fullName: "Ada Lovelace",
          email: "ada@example.com",
          currentTitle: "Engineer",
        },
      ],
      jobs: [{ id: "j1", title: "Engineer", location: "Remote" }],
      applications: [],
      interviews: [],
      offers: [],
    });
    expect(options).toHaveLength(2);
    expect(options[0]?.email).toBe("ada@example.com");
    expect(options[1]?.variables?.jobTitle).toBe("Engineer");
  });
});
