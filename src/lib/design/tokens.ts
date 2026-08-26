/**
 * Design tokens for consistent enterprise UI.
 * Use with Tailwind utility classes defined in globals.css theme.
 */
export const spacing = {
  page: "space-y-6 lg:space-y-8",
  section: "space-y-4",
  card: "p-5 sm:p-6",
} as const;

export const typography = {
  pageTitle: "text-2xl font-semibold tracking-tight text-foreground",
  sectionTitle: "text-sm font-semibold text-foreground",
  muted: "text-sm text-muted-foreground",
  label: "text-xs font-semibold uppercase tracking-wider text-muted-foreground",
} as const;

/** Maps workflow status keys to StatusBadge-friendly labels */
export const workflowStatusVariants = {
  submitted: "pending",
  pending_approval: "pending",
  approved: "approved",
  rejected: "rejected",
  withdrawn: "default",
  cancelled: "default",
} as const;
