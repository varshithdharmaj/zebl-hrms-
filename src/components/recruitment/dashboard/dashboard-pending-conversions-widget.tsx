import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Calendar } from "lucide-react";

type PendingRow = {
  id: string;
  offerNumber?: string | null;
  acceptedAt?: Date | string | null;
  candidate: { id: string; fullName: string };
  jobTitle: string;
};

export function DashboardPendingConversionsWidget({
  items,
}: {
  items: readonly PendingRow[];
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-subtle space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-foreground">Pending Conversions</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Accepted offers waiting for Convert to Employee.
          </p>
        </div>
        <Button asChild variant="ghost" size="sm" className="text-xs font-semibold">
          <Link href="/admin/recruitment/conversions">View all</Link>
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">No pending conversions.</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {items.map((item) => (
            <li key={item.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">
                  {item.candidate.fullName}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">{item.jobTitle}</p>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Calendar className="h-3 w-3" />
                  {item.acceptedAt
                    ? new Date(item.acceptedAt).toLocaleDateString()
                    : "—"}
                  {item.offerNumber ? ` · ${item.offerNumber}` : ""}
                </p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <Button asChild size="sm" className="h-7 text-[11px] font-semibold gap-1">
                  <Link href={`/admin/recruitment/conversions/${item.id}`}>
                    Convert <ArrowRight className="h-3 w-3" />
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="h-7 text-[11px] font-semibold">
                  <Link href={`/admin/recruitment/candidates/${item.candidate.id}`}>
                    Candidate
                  </Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
