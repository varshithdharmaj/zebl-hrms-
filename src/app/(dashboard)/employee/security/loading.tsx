export default function SecurityLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading security data">
      <div className="h-20 animate-pulse rounded-2xl bg-muted" />
      <div className="h-32 animate-pulse rounded-2xl bg-muted" />
      <div className="h-80 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}
