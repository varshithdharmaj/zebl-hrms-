import { renderEmailContent } from "@/lib/recruitment/communication/template-renderer";
import type { TemplateVariables } from "@/lib/recruitment/communication/template-renderer";

export function EmailPreviewPanel({
  subject,
  body,
  recipientEmail,
  additionalRecipients,
  variables,
}: {
  subject: string;
  body: string;
  recipientEmail: string;
  additionalRecipients: string[];
  variables: TemplateVariables;
}) {
  const rendered = renderEmailContent(subject || "(No subject)", body || "(Empty body)", variables);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="space-y-1 border-b border-slate-100 bg-slate-50 px-4 py-3">
        <p className="text-xs text-slate-500">
          <span className="font-semibold text-slate-700">To:</span> {recipientEmail || "—"}
        </p>
        {additionalRecipients.length > 0 && (
          <p className="text-xs text-slate-500">
            <span className="font-semibold text-slate-700">Also linked:</span>{" "}
            {additionalRecipients.join(", ")}
          </p>
        )}
        <p className="text-sm font-semibold text-slate-900">{rendered.subject}</p>
      </div>
      <div className="px-4 py-5">
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-800">
          {rendered.body}
        </pre>
      </div>
    </div>
  );
}
