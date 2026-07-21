"use client";

import { useState } from "react";
import { formatDate } from "@/lib/utils";
import { SectionCard } from "@/components/ui/section-card";
import { DataTable, DataTableRow, DataTableCell } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { AuditLogRow } from "@/lib/audit/audit-queries";

interface TicketAuditHistoryProps {
  auditLogs: AuditLogRow[];
  isAnonymous?: boolean;
  isSuperAdmin?: boolean;
}

export function TicketAuditHistory({
  auditLogs,
  isAnonymous = false,
  isSuperAdmin = false,
}: TicketAuditHistoryProps) {
  const [expanded, setExpanded] = useState(false);
  const displayLogs = expanded ? auditLogs : auditLogs.slice(0, 5);

  if (auditLogs.length === 0) {
    return null;
  }

  return (
    <SectionCard
      title="Audit History"
      description={
        isAnonymous && isSuperAdmin
          ? "Complete audit trail (Super Admin Only)"
          : `${auditLogs.length} event${auditLogs.length === 1 ? "" : "s"}`
      }
    >
      <DataTable
        columns={["Time", "Action", "Actor", "Details"]}
        emptyMessage="No audit history available."
      >
        {displayLogs.map((log) => (
          <DataTableRow key={log.id}>
            <DataTableCell className="whitespace-nowrap text-xs text-muted-foreground">
              {formatDate(log.createdAt)}
            </DataTableCell>
            <DataTableCell className="font-medium text-sm">
              {formatAuditAction(log.action)}
            </DataTableCell>
            <DataTableCell className="text-sm">
              {log.actorEmail ?? "System"}
            </DataTableCell>
            <DataTableCell className="text-xs text-muted-foreground max-w-md">
              {formatMetadata(log.metadata)}
            </DataTableCell>
          </DataTableRow>
        ))}
      </DataTable>

      {auditLogs.length > 5 && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <>
                <ChevronUp className="h-4 w-4 mr-1" />
                Show Less
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-1" />
                Show All ({auditLogs.length})
              </>
            )}
          </Button>
        </div>
      )}
    </SectionCard>
  );
}

function formatAuditAction(action: string): string {
  const formatted = action
    .replace(/^ticket\./, "")
    .replace(/\./g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  // Add emoji indicators for key events
  if (action.includes("created")) return `🎫 ${formatted}`;
  if (action.includes("assigned")) return `👤 ${formatted}`;
  if (action.includes("status")) return `📊 ${formatted}`;
  if (action.includes("resolved")) return `✅ ${formatted}`;
  if (action.includes("reopened")) return `🔄 ${formatted}`;
  if (action.includes("reply")) return `💬 ${formatted}`;
  if (action.includes("update")) return `📝 ${formatted}`;
  if (action.includes("note")) return `🔒 ${formatted}`;
  if (action.includes("priority")) return `⚡ ${formatted}`;
  if (action.includes("closed")) return `🔒 ${formatted}`;
  if (action.includes("canceled")) return `❌ ${formatted}`;

  return formatted;
}

function formatMetadata(metadata: Record<string, unknown>): string {
  if (!metadata || Object.keys(metadata).length === 0) {
    return "—";
  }

  const entries = Object.entries(metadata)
    .filter(([_, value]) => value !== null && value !== undefined)
    .map(([key, value]) => {
      const formattedKey = key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (s) => s.toUpperCase())
        .trim();

      if (typeof value === "boolean") {
        return `${formattedKey}: ${value ? "Yes" : "No"}`;
      }

      if (typeof value === "object") {
        return `${formattedKey}: ${JSON.stringify(value)}`;
      }

      return `${formattedKey}: ${value}`;
    });

  return entries.join(" • ");
}
