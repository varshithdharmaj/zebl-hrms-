import Link from "next/link";

type OfferSummary = {
  draft: number;
  sent: number;
  accepted: number;
  declined: number;
  withdrawn: number;
  expired: number;
};

const ROWS: Array<{ key: keyof OfferSummary; label: string; href: string }> = [
  { key: "draft", label: "Draft", href: "/admin/recruitment/offers?status=draft" },
  { key: "sent", label: "Sent", href: "/admin/recruitment/offers?status=released" },
  { key: "accepted", label: "Accepted", href: "/admin/recruitment/offers?status=accepted" },
  { key: "declined", label: "Declined", href: "/admin/recruitment/offers?status=declined" },
  { key: "withdrawn", label: "Withdrawn", href: "/admin/recruitment/offers?status=withdrawn" },
  { key: "expired", label: "Expired", href: "/admin/recruitment/offers?status=expired" },
];

export function DashboardOfferSummaryWidget({ summary }: { summary: OfferSummary }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-subtle">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-foreground">Offer Summary</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Current offer letter status counts.</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {ROWS.map((row) => (
          <Link
            key={row.key}
            href={row.href}
            className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5 hover:bg-muted/20 transition-colors"
          >
            <div className="text-lg font-bold tabular-nums text-foreground">{summary[row.key]}</div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {row.label}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
