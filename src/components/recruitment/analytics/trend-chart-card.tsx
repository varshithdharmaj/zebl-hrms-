"use client";

import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp } from "lucide-react";

interface TrendChartCardProps {
  data: {
    dates: string[];
    applications: number[];
    interviews: number[];
    offers: number[];
    hires: number[];
  };
}

export function TrendChartCard({ data }: TrendChartCardProps) {
  const [activeMetric, setActiveMetric] = useState<"applications" | "interviews" | "offers" | "hires">("applications");

  const metrics = {
    applications: { label: "Applications", data: data.applications, color: "blue" },
    interviews: { label: "Interviews", data: data.interviews, color: "teal" },
    offers: { label: "Offers", data: data.offers, color: "green" },
    hires: { label: "Hires", data: data.hires, color: "amber" },
  };

  const currentData = metrics[activeMetric].data;
  const maxValue = Math.max(...currentData, 1);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            <CardTitle>Trend Analysis</CardTitle>
          </div>
          <div className="flex gap-2">
            {Object.entries(metrics).map(([key, metric]) => (
              <Button
                key={key}
                size="sm"
                variant={activeMetric === key ? "default" : "outline"}
                onClick={() => setActiveMetric(key as any)}
                className="text-xs"
              >
                {metric.label}
              </Button>
            ))}
          </div>
        </div>
        <CardDescription>
          {metrics[activeMetric].label} trend over time
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {currentData.map((value, index) => {
            const date = data.dates[index];
            const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;

            return (
              <div key={index} className="flex items-center gap-2">
                <span className="text-xs text-slate-500 w-20 flex-shrink-0">
                  {new Date(date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <div className="flex-1 relative h-6 bg-slate-100 rounded overflow-hidden">
                  <div
                    className={`absolute inset-y-0 left-0 bg-${metrics[activeMetric].color}-500 flex items-center justify-center text-white text-xs font-medium transition-all`}
                    style={{ width: `${Math.max(percentage, 5)}%` }}
                  >
                    {value > 0 && percentage > 15 && value}
                  </div>
                </div>
                <span className="text-xs font-medium text-slate-900 w-8 text-right">
                  {value}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
