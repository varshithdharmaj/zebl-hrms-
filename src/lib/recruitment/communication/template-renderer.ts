export type TemplateVariables = {
  candidateName?: string;
  jobTitle?: string;
  company?: string;
  interviewer?: string;
  date?: string;
  interviewDate?: string;
  time?: string;
  location?: string;
  offerSalary?: string;
  offerAmount?: string;
  joiningDate?: string;
  [key: string]: string | undefined;
};

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g;

/**
 * Replace {{placeholder}} tokens. Unknown keys become empty string.
 */
function resolveVariable(
  key: string,
  variables: TemplateVariables
): string | undefined {
  if (variables[key] !== undefined) return variables[key];
  if (key === "interviewDate") return variables.date;
  if (key === "date") return variables.interviewDate ?? variables.date;
  if (key === "offerAmount") return variables.offerSalary;
  if (key === "offerSalary") return variables.offerAmount ?? variables.offerSalary;
  return undefined;
}

export function renderTemplate(
  template: string,
  variables: TemplateVariables
): string {
  return template.replace(PLACEHOLDER_RE, (_match, key: string) => {
    return resolveVariable(key, variables) ?? "";
  });
}

export function renderEmailContent(
  subject: string,
  body: string,
  variables: TemplateVariables
): { subject: string; body: string } {
  return {
    subject: renderTemplate(subject, variables),
    body: renderTemplate(body, variables),
  };
}

export function extractPlaceholders(template: string): string[] {
  const keys = new Set<string>();
  for (const match of template.matchAll(PLACEHOLDER_RE)) {
    keys.add(match[1]);
  }
  return [...keys];
}
