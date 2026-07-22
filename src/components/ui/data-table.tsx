import { cn } from "@/lib/utils";

export function DataTable({
  columns,
  children,
  emptyMessage = "No records found.",
  className,
}: {
  columns: string[];
  children: React.ReactNode;
  emptyMessage?: string;
  className?: string;
}) {
  const isEmpty =
    !children || (Array.isArray(children) && children.length === 0);

  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/80">
            {columns.map((col) => (
              <th
                key={col}
                className="sticky top-0 z-10 whitespace-nowrap bg-muted/90 px-4 py-3 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-card">
          {isEmpty ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-5 py-12 text-center text-sm text-muted-foreground"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}

export function DataTableRow({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLTableRowElement>;
}) {
  return (
    <tr
      className={cn("transition-colors hover:bg-muted/60", className)}
      onClick={onClick}
    >
      {children}
    </tr>
  );
}

export function DataTableCell({
  children,
  className,
  colSpan,
}: {
  children: React.ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={cn("px-5 py-3.5 text-[0.875rem] text-foreground/90", className)}
    >
      {children}
    </td>
  );
}
