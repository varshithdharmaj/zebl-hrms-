import { formatDate } from "@/lib/utils";

type Doc = {
  version: string;
  effectiveFrom: Date;
  content: string;
};

/** Minimal, dependency-free renderer for our own authored Markdown-ish policy content (headings, bullets, bold) — not a general-purpose Markdown parser, and never fed untrusted input. */
function renderInline(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

export function LeavePolicyDocumentView({ document }: { document: Doc | null }) {
  if (!document) {
    return (
      <p className="text-sm text-muted-foreground">
        No leave policy document is currently published.
      </p>
    );
  }

  const lines = document.content.split("\n");
  const blocks: React.ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = (key: string) => {
    if (listItems.length === 0) return;
    blocks.push(
      <ul key={key} className="ml-5 list-disc space-y-1 text-sm text-foreground">
        {listItems.map((item, i) => (
          <li key={i} dangerouslySetInnerHTML={{ __html: renderInline(item) }} />
        ))}
      </ul>
    );
    listItems = [];
  };

  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (line.startsWith("- ")) {
      listItems.push(line.slice(2));
      return;
    }
    flushList(`list-${i}`);

    if (line.startsWith("## ")) {
      blocks.push(
        <h3 key={i} className="mt-6 text-base font-semibold text-foreground">
          {line.slice(3)}
        </h3>
      );
    } else if (line.startsWith("# ")) {
      blocks.push(
        <h2 key={i} className="text-lg font-bold text-foreground">
          {line.slice(2)}
        </h2>
      );
    } else if (line.length > 0) {
      blocks.push(
        <p
          key={i}
          className="text-sm text-muted-foreground"
          dangerouslySetInnerHTML={{ __html: renderInline(line) }}
        />
      );
    }
  });
  flushList("list-end");

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Version {document.version} · Effective from {formatDate(document.effectiveFrom)}
      </p>
      <div className="space-y-3">{blocks}</div>
    </div>
  );
}
