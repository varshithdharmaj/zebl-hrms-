import { describe, expect, it } from "vitest";
import {
  extractPlaceholders,
  renderEmailContent,
  renderTemplate,
} from "@/lib/recruitment/communication/template-renderer";

describe("template-renderer", () => {
  it("replaces known placeholders", () => {
    const result = renderTemplate(
      "Hello {{candidateName}}, role {{jobTitle}}",
      { candidateName: "Ada", jobTitle: "Engineer" }
    );
    expect(result).toBe("Hello Ada, role Engineer");
  });

  it("replaces unknown placeholders with empty string", () => {
    expect(renderTemplate("Hi {{missing}}", {})).toBe("Hi ");
  });

  it("supports whitespace inside braces", () => {
    expect(renderTemplate("Hi {{ candidateName }}", { candidateName: "Bo" })).toBe(
      "Hi Bo"
    );
  });

  it("renders subject and body together", () => {
    const rendered = renderEmailContent(
      "Offer for {{candidateName}}",
      "Join on {{joiningDate}}",
      { candidateName: "Ada", joiningDate: "2026-09-01" }
    );
    expect(rendered.subject).toBe("Offer for Ada");
    expect(rendered.body).toBe("Join on 2026-09-01");
  });

  it("extracts unique placeholders", () => {
    const keys = extractPlaceholders("{{a}} {{b}} {{a}}");
    expect(keys.sort()).toEqual(["a", "b"]);
  });
});
