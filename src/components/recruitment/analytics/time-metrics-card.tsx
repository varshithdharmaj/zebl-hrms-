import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";

interface TimeMetricsCardProps {
  metrics: {
    applicationToInterview: number;
    interviewToOffer: number;
    offerToHire: number;
    totalTimeToHire: number;
  };
}

export function TimeMetricsCard({ metrics }: TimeMetricsCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-amber-600" />
          <CardTitle>Time Metrics</CardTitle>
        </div>
        <CardDescription>Average time between stages (in days)</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-md">
            <span className="text-sm text-slate-700">Application → Interview</span>
            <span className="text-lg font-bold text-slate-900">
              {metrics.applicationToInterview}d
            </span>
          </div>
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-md">
            <span className="text-sm text-slate-700">Interview → Offer</span>
            <span className="text-lg font-bold text-slate-900">
              {metrics.interviewToOffer}d
            </span>
          </div>
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-md">
            <span className="text-sm text-slate-700">Offer → Hire</span>
            <span className="text-lg font-bold text-slate-900">
              {metrics.offerToHire}d
            </span>
          </div>
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-teal-50 rounded-md border border-blue-200">
            <span className="text-sm font-semibold text-slate-900">Total Time to Hire</span>
            <span className="text-2xl font-bold text-blue-600">
              {metrics.totalTimeToHire}d
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
