export function TicketListEmpty({ message }: { message: string }) {
  return (
    <p className="py-12 text-center text-sm text-muted-foreground">{message}</p>
  );
}
