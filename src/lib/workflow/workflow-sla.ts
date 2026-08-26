import { getIntegrationSettings } from "@/lib/integrations/integration-settings";

export async function getEscalationSlaHours(): Promise<number> {
  const settings = await getIntegrationSettings();
  return settings.escalationHours;
}

export function computeSlaState(submittedAt: Date | null, escalationHours: number): {
  label: string;
  hoursRemaining: number | null;
  overdue: boolean;
  percentElapsed: number;
} {
  if (!submittedAt) {
    return { label: "—", hoursRemaining: null, overdue: false, percentElapsed: 0 };
  }

  const elapsedMs = Date.now() - submittedAt.getTime();
  const totalMs = escalationHours * 60 * 60 * 1000;
  const percentElapsed = Math.min(100, Math.round((elapsedMs / totalMs) * 100));
  const hoursRemaining = Math.max(0, Math.ceil((totalMs - elapsedMs) / (1000 * 60 * 60)));
  const overdue = elapsedMs > totalMs;

  return {
    label: overdue ? "Overdue" : `${hoursRemaining}h left`,
    hoursRemaining: overdue ? 0 : hoursRemaining,
    overdue,
    percentElapsed,
  };
}
