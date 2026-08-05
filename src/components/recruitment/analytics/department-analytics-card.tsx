import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2 } from "lucide-react";

interface DepartmentAnalyticsCardProps {
  analytics: Array<{
    department: string;
    openPositions: number;
    filledPositions: number;
    offers: number;
    acceptanceRate: number;
  }>;
}

export function DepartmentAnalyticsCard({ analytics }: DepartmentAnalyticsCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-teal-600" />
          <CardTitle>Department Analytics</CardTitle>
        </div>
        <CardDescription>Hiring metrics by department</CardDescription>
      </CardHeader>
      <CardContent>
        {analytics.length === 0 ? (
          <p className="text-sm text-slate-500">No department data available</p>
        ) : (
          <div className="space-y-3">
            {analytics.map((dept) => (
              <div
                key={dept.department}
                className="p-4 border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-slate-900">{dept.department}</h4>
                  <Badge variant="outline" className="text-xs">
                    {dept.acceptanceRate}% acceptance
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500 text-xs">Open</p>
                    <p className="font-medium text-slate-900 mt-1">{dept.openPositions}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">Filled</p>
                    <p className="font-medium text-green-600 mt-1">{dept.filledPositions}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">Offers</p>
                    <p className="font-medium text-slate-900 mt-1">{dept.offers}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
