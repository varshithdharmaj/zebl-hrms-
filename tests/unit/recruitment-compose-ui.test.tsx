import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RecruitmentEmailTemplateType } from "@/generated/prisma/enums";
import { ComposeEditor } from "@/components/recruitment/communications/compose/compose-editor";
import { PlaceholderPreview } from "@/components/recruitment/communications/compose/placeholder-preview";
import { TemplateSelector } from "@/components/recruitment/communications/compose/template-selector";
import { AutosaveIndicator } from "@/components/recruitment/communications/compose/autosave-indicator";
import { ComposeFooter } from "@/components/recruitment/communications/compose/compose-footer";
import { EmailPreviewPanel } from "@/components/recruitment/communications/compose/email-preview-panel";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

describe("Compose UI", () => {
  it("renders editor with character counters", () => {
    const html = renderToStaticMarkup(
      <ComposeEditor
        subject="Hello"
        body="World"
        onSubjectChange={() => undefined}
        onBodyChange={() => undefined}
        onUndoWarning={() => undefined}
      />
    );
    expect(html).toContain("Subject");
    expect(html).toContain("5/500");
    expect(html).toContain("5/20000");
    expect(html).toContain("Compose formatting toolbar");
  });

  it("renders placeholder preview with substituted values", () => {
    const html = renderToStaticMarkup(
      <PlaceholderPreview
        subject="Hi {{candidateName}}"
        body="Role {{jobTitle}}"
        variables={{ candidateName: "Ada", jobTitle: "Engineer" }}
      />
    );
    expect(html).toContain("Hi Ada");
    expect(html).toContain("Role Engineer");
    expect(html).toContain("Live preview");
  });

  it("renders template selector options", () => {
    const html = renderToStaticMarkup(
      <TemplateSelector
        value="system:general"
        onChange={() => undefined}
        templates={[
          {
            id: "system:general",
            name: "General Message",
            type: RecruitmentEmailTemplateType.general,
            subject: "Subject",
            body: "Body",
            isSystem: true,
          },
        ]}
      />
    );
    expect(html).toContain("Email template");
  });

  it("renders autosave states", () => {
    expect(renderToStaticMarkup(<AutosaveIndicator status="saving" />)).toContain(
      "Saving draft"
    );
    expect(renderToStaticMarkup(<AutosaveIndicator status="saved" />)).toContain(
      "Draft saved"
    );
    expect(renderToStaticMarkup(<AutosaveIndicator status="error" />)).toContain(
      "Autosave failed"
    );
  });

  it("renders footer actions", () => {
    const html = renderToStaticMarkup(
      <ComposeFooter
        canSend
        pending={false}
        hasDraft
        onPreview={() => undefined}
        onSave={() => undefined}
        onSend={() => undefined}
        onDiscard={() => undefined}
      />
    );
    expect(html).toContain("Preview");
    expect(html).toContain("Save draft");
    expect(html).toContain("Send");
    expect(html).toContain("Discard");
  });

  it("renders email preview panel with rendered placeholders", () => {
    const html = renderToStaticMarkup(
      <EmailPreviewPanel
        subject="Offer for {{candidateName}}"
        body="Join {{company}}"
        recipientEmail="ada@example.com"
        additionalRecipients={["hr@zebl.com"]}
        variables={{ candidateName: "Ada", company: "ZEBL" }}
      />
    );
    expect(html).toContain("Offer for Ada");
    expect(html).toContain("Join ZEBL");
    expect(html).toContain("ada@example.com");
    expect(html).toContain("hr@zebl.com");
  });
});
