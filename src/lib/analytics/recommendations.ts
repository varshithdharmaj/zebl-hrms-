import { randomUUID } from "crypto";
import type {
  AnomalyCandidate,
  Recommendation,
  DateRange,
} from "@/lib/analytics/analytics-types";
import { buildWorkflowInsights } from "@/lib/analytics/workflow-insights";
import { buildLeaveInsights } from "@/lib/analytics/leave-insights";

export async function generateRecommendations(
  range: DateRange,
  anomalies: AnomalyCandidate[]
): Promise<Recommendation[]> {
  const recs: Recommendation[] = [];
  const [workflow, leave] = await Promise.all([
    buildWorkflowInsights(range),
    buildLeaveInsights(range),
  ]);

  for (const w of workflow.recommendations) {
    recs.push({
      id: randomUUID(),
      category: "workflow",
      priority: "medium",
      title: "Workflow optimization",
      detail: w,
      rationale: "Derived from approval turnaround and pending step analysis.",
      scope: "organization",
      scopeKey: "org",
    });
  }

  for (const risk of leave.projectedStaffingRisks) {
    recs.push({
      id: randomUUID(),
      category: "staffing",
      priority: "high",
      title: "Staffing risk",
      detail: risk,
      rationale: "Projected from upcoming pending leave overlap by department.",
      scope: "organization",
      scopeKey: "org",
    });
  }

  for (const warn of leave.saturationWarnings) {
    recs.push({
      id: randomUUID(),
      category: "leave_planning",
      priority: "medium",
      title: "Leave planning",
      detail: warn,
      rationale: "Seasonal clustering detection on historical leave density.",
      scope: "organization",
      scopeKey: "org",
    });
  }

  for (const a of anomalies) {
    if (a.anomalyType === "approval_bottleneck") {
      recs.push({
        id: randomUUID(),
        category: "escalation",
        priority: "high",
        title: a.title,
        detail: a.description,
        rationale: a.explanation,
        scope: a.scope,
        scopeKey: a.scopeKey,
      });
    }
  }

  return recs.slice(0, 20);
}
