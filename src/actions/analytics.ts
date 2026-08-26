"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/auth-guards";
import { runAnalyticsAggregation, queueNightlyAnalytics } from "@/lib/analytics/analytics-engine";

export type AnalyticsActionState = {
  error?: string;
  success?: string;
};

export async function runAnalyticsNowAction(
  _prev: AnalyticsActionState,
  _formData?: FormData
): Promise<AnalyticsActionState> {
  try {
    await requireAdminSession();
    const result = await runAnalyticsAggregation(`manual-${Date.now()}`);
    revalidatePath("/admin/analytics");
    return {
      success: `Analytics complete: ${result.metrics} metrics, ${result.anomalies} new anomalies.`,
    };
  } catch {
    return { error: "Analytics run failed." };
  }
}

export async function queueAnalyticsJobAction(): Promise<AnalyticsActionState> {
  try {
    await requireAdminSession();
    await queueNightlyAnalytics();
    return { success: "Analytics job queued." };
  } catch {
    return { error: "Failed to queue analytics job." };
  }
}
