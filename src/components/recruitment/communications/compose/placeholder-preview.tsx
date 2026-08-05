"use client";

import { renderEmailContent } from "@/lib/recruitment/communication/template-renderer";
import type { TemplateVariables } from "@/lib/recruitment/communication/template-renderer";

export function PlaceholderPreview({
  subject,
  body,
  variables,
}: {
  subject: string;
  body: string;
  variables: TemplateVariables;
}) {
  const rendered = renderEmailContent(subject || "(No subject)", body || "(No body)", variables);

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-slate-200 bg-slate-50/80 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        Live preview
      </p>
      <p className="text-sm font-semibold text-slate-900">{rendered.subject}</p>
      <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-slate-700">
        {rendered.body}
      </pre>
    </div>
  );
}
