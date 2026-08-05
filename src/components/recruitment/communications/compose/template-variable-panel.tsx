"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TEMPLATE_PLACEHOLDERS } from "@/lib/recruitment/communication/system-templates";
import type { TemplateVariables } from "@/lib/recruitment/communication/template-renderer";

const LABELS: Record<string, string> = {
  candidateName: "Candidate name",
  jobTitle: "Job title",
  company: "Company",
  interviewer: "Interviewer",
  date: "Date",
  time: "Time",
  location: "Location",
  offerSalary: "Offer salary",
  joiningDate: "Joining date",
};

export function TemplateVariablePanel({
  variables,
  onChange,
}: {
  variables: TemplateVariables;
  onChange: (key: keyof TemplateVariables, value: string) => void;
}) {
  return (
    <section
      className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-subtle"
      aria-label="Template variables"
    >
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Placeholders</h2>
        <p className="text-xs text-slate-500">
          Values used when previewing or sending templated content.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {TEMPLATE_PLACEHOLDERS.map((key) => (
          <div key={key} className="space-y-1.5">
            <Label htmlFor={`var-${key}`} className="text-xs">
              {LABELS[key] ?? key}
            </Label>
            <Input
              id={`var-${key}`}
              value={variables[key] ?? ""}
              onChange={(event) => onChange(key, event.target.value)}
              placeholder={`{{${key}}}`}
              className="h-9"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
