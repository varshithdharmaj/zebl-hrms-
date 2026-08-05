import Link from "next/link";
import { MessagesSquare } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { formatRelativeTimestamp } from "../relative-time";

export type EntityCommunicationItem = {
  id: string;
  subject: string | null;
  status: string;
  type: string;
  threadId: string | null;
  occurredAt: string;
};

export function EntityCommunicationTimeline({
  title,
  items,
  composeHref,
  emptyDescription,
}: {
  title: string;
  items: EntityCommunicationItem[];
  composeHref: string;
  emptyDescription: string;
}) {
  return (
    <section
      className="rounded-xl border border-border/70 bg-card p-4 shadow-subtle space-y-3"
      aria-label={title}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <Button asChild size="sm" variant="outline">
          <Link href={composeHref}>Compose</Link>
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={MessagesSquare}
          title="No communications"
          description={emptyDescription}
          className="min-h-0 py-6"
        />
      ) : (
        <ol className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="relative border-l-2 border-border/70 pl-3 ml-1">
              <span className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-primary/60 ring-4 ring-background" />
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                  {item.status}
                </span>
                <time className="text-[10px] text-muted-foreground">
                  {formatRelativeTimestamp(item.occurredAt)}
                </time>
              </div>
              <p className="mt-1 text-xs font-semibold text-foreground">
                {item.subject?.trim() || "Untitled"}
              </p>
              <Link
                href={`/admin/recruitment/communications?threadId=${encodeURIComponent(item.threadId ?? item.id)}`}
                className="mt-1 inline-block text-[11px] font-semibold text-primary hover:underline"
              >
                Open thread
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
