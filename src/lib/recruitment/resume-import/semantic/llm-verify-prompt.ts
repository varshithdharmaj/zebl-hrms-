import type { ParsedResumeDraft } from "../parser/types";
import type { ResumeAmbiguity } from "./ambiguity";
import { SEMANTIC_VERIFY_PROMPT_VERSION } from "./llm-verify-schema";

export const RESUME_SEMANTIC_VERIFY_SYSTEM_PROMPT = `You are verifying structured resume extraction.

You are NOT writing a resume.
You are NOT allowed to invent information.

Only use evidence explicitly present in the supplied resume text.
The deterministic parser is the primary source.
Your job is only to resolve ambiguity.

If evidence is insufficient: return action "leave_empty".

A candidate's name is never a headline.
A project is not employment.
Education is not employment.
A company name is not automatically a job.
A technology name is not automatically a skill unless supported by context.

Never invent:
- employers
- job titles
- dates
- degrees
- institutions
- projects
- skills
- locations

Return JSON only matching the required schema.
Prefer leave_empty over unsupported inference.
Prefer reject over accepting a wrong-field assignment.
When reclassifying, set proposedSection to the correct section.
candidateId values refer to deterministic entities (exp:0, proj:1, edu:0, headline, current_role).`;

const MAX_USER_CHARS = 14_000;

function redactContacts(text: string): string {
  return text
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[email]")
    .replace(
      /(?:\+\d{1,3}[\s.-]*)?(?:\(?\d{2,4}\)?[\s.-]*)?\d{3,5}[\s.-]*\d{3,5}/g,
      "[phone]"
    );
}

export function buildSemanticVerifyUserPrompt(input: {
  draft: ParsedResumeDraft;
  ambiguity: ResumeAmbiguity;
}): string {
  const { draft, ambiguity } = input;
  const candidates = {
    name: draft.personal.fullName,
    headline: draft.professional.headline,
    currentTitle: draft.professional.currentTitle,
    currentCompany: draft.professional.currentCompany,
    experiences: draft.experiences.map((e, i) => ({
      id: `exp:${i}`,
      title: e.title,
      company: e.company,
      startDate: e.startDate,
      endDate: e.endDate,
      isCurrent: e.isCurrent,
    })),
    educations: draft.educations.map((e, i) => ({
      id: `edu:${i}`,
      institution: e.institution,
      degree: e.degree,
      field: e.field,
      graduationYear: e.graduationYear,
    })),
    projects: draft.projects.map((p, i) => ({
      id: `proj:${i}`,
      title: p.title,
      summary: p.summary,
      techStack: p.techStack,
    })),
  };

  const payload = {
    promptVersion: SEMANTIC_VERIFY_PROMPT_VERSION,
    ambiguityReasons: ambiguity.reasons,
    deterministicCandidates: candidates,
    spans: ambiguity.spans.map((s) => ({
      section: s.section,
      candidateIds: s.candidateIds,
      text: redactContacts(s.text),
    })),
    outputSchema: {
      version: 1,
      decisions: [
        {
          type: "experience|project|education|headline|current_role|section",
          action: "accept|reject|reclassify|leave_empty",
          candidateId: "string|null",
          reason: "string",
          evidence: ["verbatim snippets from spans"],
          proposedSection:
            "experience|projects|education|skills|certifications|summary|other|null",
        },
      ],
    },
  };

  let json = JSON.stringify(payload, null, 2);
  if (json.length > MAX_USER_CHARS) {
    json = JSON.stringify(
      {
        ...payload,
        spans: payload.spans.map((s) => ({
          ...s,
          text:
            s.text.length > 1200 ? `${s.text.slice(0, 1200)}\n…[truncated]` : s.text,
        })),
      },
      null,
      2
    );
  }

  return `Verify the following ambiguous resume extraction. Respond with JSON only.\n\n${json}`;
}
