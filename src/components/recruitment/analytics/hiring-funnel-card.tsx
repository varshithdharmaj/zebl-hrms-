import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Filter } from "lucide-react";

interface HiringFunnelCardProps {
  funnel: {
    candidates: number;
    applications: number;
    interviews: number;
    offers: number;
    accepted: number;
    employees: number;
  };
}

export function HiringFunnelCard({ funnel }: HiringFunnelCardProps) {
  const stages = [
    { label: "Candidates", value: funnel.candidates },
    { label: "Applications", value: funnel.applications },
    { label: "Interviews", value: funnel.interviews },
    { label: "Offers", value: funnel.offers },
    { label: "Accepted", value: funnel.accepted },
    { label: "Employees", value: funnel.employees },
  ];

  const calculateDropoff = (current: number, previous: number) => {
    if (previous === 0) return 0;
    return Math.round(((previous - current) / previous) * 100);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-blue-600" />
          <CardTitle>Hiring Funnel</CardTitle>
        </div>
        <CardDescription>Conversion flow from candidates to employees</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {stages.map((stage, index) => {
            const percentage = funnel.candidates > 0
              ? Math.round((stage.value / funnel.candidates) * 100)
              : 0;
            const dropoff = index > 0
              ? calculateDropoff(stage.value, stages[index - 1].value)
              : 0;

            return (
              <div key={stage.label} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-900">{stage.label}</span>
                  <span className="text-slate-500">
                    {stage.value} ({percentage}%)
                  </span>
                </div>
                <div className="relative h-8 bg-slate-100 rounded-md overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-medium"
                    style={{ width: `${Math.max(percentage, 5)}%` }}
                  >
                    {percentage > 10 && `${percentage}%`}
                  </div>
                </div>
                {index > 0 && dropoff > 0 && (
                  <p className="text-xs text-slate-500">
                    {dropoff}% drop-off from previous stage
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
