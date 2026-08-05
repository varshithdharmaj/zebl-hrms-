import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";

/** Minimal Phase 3 route placeholder — full My Team pages ship in later phases. */
export function MyTeamComingSoon({ title }: { title: string }) {
  return (
    <div className="space-y-6">
      <WorkspacePageHeader title={title} description="My Team page coming soon" />
      <p className="text-sm text-muted-foreground">My Team page coming soon</p>
    </div>
  );
}
