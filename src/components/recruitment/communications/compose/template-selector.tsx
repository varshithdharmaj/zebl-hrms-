"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ComposeTemplateOption } from "@/lib/recruitment/communication/system-templates";

export function TemplateSelector({
  templates,
  value,
  onChange,
}: {
  templates: ComposeTemplateOption[];
  value: string | null;
  onChange: (template: ComposeTemplateOption | null) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor="template-selector" className="text-xs font-semibold text-slate-600">
        Email template
      </label>
      <Select
        value={value ?? "none"}
        onValueChange={(next) => {
          if (next === "none") {
            onChange(null);
            return;
          }
          const selected = templates.find((template) => template.id === next) ?? null;
          onChange(selected);
        }}
      >
        <SelectTrigger id="template-selector" className="h-10" aria-label="Select email template">
          <SelectValue placeholder="No template" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No template</SelectItem>
          {templates.map((template) => (
            <SelectItem key={template.id} value={template.id}>
              {template.name}
              {template.isSystem ? " (System)" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
