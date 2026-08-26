export function ErrorAlert({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-danger/20 bg-danger-muted px-4 py-3 text-sm text-danger">
      {message}
    </div>
  );
}
