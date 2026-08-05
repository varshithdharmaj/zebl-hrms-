import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GitBranch, AlertCircle } from "lucide-react";

interface PipelineMetricsCardProps {
  metrics: {
    byStage: Array<{ stage: string; count: number; avgDays: number }>;
    stuckCandidates: number;
  };
}

export function PipelineMetricsCard({ metrics }: PipelineMetricsCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <GitBranch className="h-5 w-5 text-teal-600" />
          <CardTitle>Pipeline Metrics</CardTitle>
        </div>
        <CardDescription>Applications by stage and aging analysis</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {metrics.stuckCandidates > 0 && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <span className="text-sm text-amber-900">
                <strong>{metrics.stuckCandidates}</strong> candidates stuck for 30+ days
              </span>
            </div>
          )}

          <div className="space-y-3">
            {metrics.byStage.length === 0 ? (
              <p className="text-sm text-slate-500">No active applications in pipeline</p>
            ) : (
              metrics.byStage.map((stage) => (
                <div
                  key={stage.stage}
                  className="flex items-center justify-between p-3 border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-slate-900 capitalize">
                      {stage.stage.replace(/_/g, " ")}
                    </span>
                    {stage.avgDays > 0 && (
                      <span className="text-xs text-slate-500 mt-1">
                        Avg. {stage.avgDays} days
                      </span>
                    )}
                  </div>
                  <Badge variant="outline" className="font-medium">
                    {stage.count}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
