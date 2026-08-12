export type CandidateWorkspaceTab = "overview" | "applications" | "documents" | "activity";

const WORKSPACE_TABS = new Set<CandidateWorkspaceTab>([
  "overview",
  "applications",
  "documents",
  "activity",
]);

export function parseCandidateWorkspaceTab(
  raw: Record<string, string | string[] | undefined>
): CandidateWorkspaceTab {
  const value = raw.tab;
  if (typeof value !== "string" || value.length === 0) {
    return "overview";
  }
  return WORKSPACE_TABS.has(value as CandidateWorkspaceTab)
    ? (value as CandidateWorkspaceTab)
    : "overview";
}

/** Preserve existing search params while switching workspace tabs. */
export function buildCandidateWorkspaceTabHref(
  pathname: string,
  currentQuery: Record<string, string | string[] | undefined>,
  tab: CandidateWorkspaceTab
): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(currentQuery)) {
    if (key === "tab" || value == null) continue;
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (entry.length > 0) params.append(key, entry);
      }
    } else if (value.length > 0) {
      params.set(key, value);
    }
  }

  if (tab !== "overview") {
    params.set("tab", tab);
  }

  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
