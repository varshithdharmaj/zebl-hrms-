import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";

interface TimeMetricsCardProps {
  metrics: {
    applicationToInterview: number | null;
    interviewToOffer: number | null;
    offerToHire: number | null;
    totalTimeToHire: number | null;
    sampleSize?: number;
  };
}

function formatDays(value: number | null): string {
  return value == null ? "—" : `${value}d`;
}

export function TimeMetricsCard({ metrics }: TimeMetricsCardProps) {
  const hasAny =
    metrics.totalTimeToHire != null ||
    metrics.applicationToInterview != null ||
    metrics.interviewToOffer != null ||
    metrics.offerToHire != null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-amber-600" />
          <CardTitle>Time to Hire</CardTitle>
        </div>
        <CardDescription>
          Average days from converted hires
          {typeof metrics.sampleSize === "number"
            ? ` (n=${metrics.sampleSize})`
            : ""}
          . Blank means not enough data.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!hasAny ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No conversions in this period — time metrics unavailable.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-md">
              <span className="text-sm text-slate-700">Application → Interview</span>
              <span className="text-lg font-bold text-slate-900">
                {formatDays(metrics.applicationToInterview)}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-md">
              <span className="text-sm text-slate-700">Interview → Offer</span>
              <span className="text-lg font-bold text-slate-900">
                {formatDays(metrics.interviewToOffer)}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-md">
              <span className="text-sm text-slate-700">Offer Accepted → Hire</span>
              <span className="text-lg font-bold text-slate-900">
                {formatDays(metrics.offerToHire)}
              </span>
            </div>
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-md border border-blue-200">
              <span className="text-sm font-semibold text-slate-900">
                Total Time to Hire
              </span>
              <span className="text-2xl font-bold text-blue-600">
                {formatDays(metrics.totalTimeToHire)}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
