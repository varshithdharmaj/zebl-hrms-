"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ErrorAlert } from "@/components/ui/error-alert";
import { addCandidateTagAction, removeCandidateTagAction } from "@/actions/recruitment-tags";

export type CandidateTagView = { id: string; name: string; color: string | null };

export function CandidateTagsInput({
  candidateId,
  tags,
}: {
  candidateId: string;
  tags: CandidateTagView[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);

  const handleAdd = () => {
    const tagName = draft.trim();
    if (!tagName) {
      setAdding(false);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await addCandidateTagAction({}, { candidateId, tagName });
      if (res.error) {
        setError(res.error);
        return;
      }
      setDraft("");
      setAdding(false);
      router.refresh();
    });
  };

  const handleRemove = (tagId: string) => {
    setError(null);
    startTransition(async () => {
      const res = await removeCandidateTagAction({}, { candidateId, tagId });
      if (res.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-2">
      {error ? <ErrorAlert message={error} /> : null}
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted px-2 py-0.5 text-[11px] font-semibold text-foreground"
            style={tag.color ? { borderColor: tag.color, color: tag.color } : undefined}
          >
            {tag.name}
            <button
              type="button"
              onClick={() => handleRemove(tag.id)}
              disabled={isPending}
              className="text-muted-foreground hover:text-red-600"
              title={`Remove ${tag.name}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}

        {adding ? (
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={handleAdd}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
              if (e.key === "Escape") {
                setDraft("");
                setAdding(false);
              }
            }}
            maxLength={40}
            placeholder="Tag name…"
            className="h-6 w-28 px-2 text-[11px]"
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            disabled={isPending}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-border/60 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground hover:border-primary/50 hover:text-primary"
          >
            <Plus className="h-3 w-3" />
            Add tag
          </button>
        )}
      </div>
    </div>
  );
}
