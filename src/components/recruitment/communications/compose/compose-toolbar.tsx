"use client";

import { Bold, Italic, List, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ComposeToolbar({
  onInsert,
  onUndoWarning,
}: {
  onInsert: (snippet: string) => void;
  onUndoWarning: () => void;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5"
      role="toolbar"
      aria-label="Compose formatting toolbar"
    >
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-8 px-2"
        onClick={() => onInsert("**bold**")}
        aria-label="Insert bold markers"
      >
        <Bold className="h-3.5 w-3.5" aria-hidden />
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-8 px-2"
        onClick={() => onInsert("_italic_")}
        aria-label="Insert italic markers"
      >
        <Italic className="h-3.5 w-3.5" aria-hidden />
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-8 px-2"
        onClick={() => onInsert("\n- ")}
        aria-label="Insert bullet list item"
      >
        <List className="h-3.5 w-3.5" aria-hidden />
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-8 px-2 text-amber-700"
        onClick={onUndoWarning}
        aria-label="Warn about unsaved undo"
      >
        <Undo2 className="h-3.5 w-3.5" aria-hidden />
      </Button>
    </div>
  );
}
