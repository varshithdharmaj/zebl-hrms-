"use client";

import { useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ComposeToolbar } from "./compose-toolbar";
import { BODY_MAX, SUBJECT_MAX } from "./compose-types";

export function ComposeEditor({
  subject,
  body,
  onSubjectChange,
  onBodyChange,
  onUndoWarning,
}: {
  subject: string;
  body: string;
  onSubjectChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onUndoWarning: () => void;
}) {
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  function insertSnippet(snippet: string) {
    const el = bodyRef.current;
    if (!el) {
      onBodyChange(`${body}${snippet}`);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = `${body.slice(0, start)}${snippet}${body.slice(end)}`;
    onBodyChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + snippet.length;
      el.setSelectionRange(cursor, cursor);
    });
  }

  return (
    <section
      className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-subtle"
      aria-label="Compose editor"
    >
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="compose-subject">Subject</Label>
          <span className="text-[11px] text-slate-400">
            {subject.length}/{SUBJECT_MAX}
          </span>
        </div>
        <Input
          id="compose-subject"
          value={subject}
          maxLength={SUBJECT_MAX}
          onChange={(event) => onSubjectChange(event.target.value)}
          placeholder="Email subject"
          className="h-10"
          required
        />
      </div>

      <ComposeToolbar onInsert={insertSnippet} onUndoWarning={onUndoWarning} />

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="compose-body">Body</Label>
          <span className="text-[11px] text-slate-400">
            {body.length}/{BODY_MAX}
          </span>
        </div>
        <Textarea
          id="compose-body"
          ref={bodyRef}
          value={body}
          maxLength={BODY_MAX}
          onChange={(event) => onBodyChange(event.target.value)}
          placeholder="Write your message…"
          className="min-h-[18rem] resize-y"
          required
        />
      </div>
    </section>
  );
}
