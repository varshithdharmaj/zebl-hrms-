import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target } from "lucide-react";

interface SourceAnalyticsCardProps {
  analytics: Array<{
    source: string;
    applications: number;
    interviews: number;
    offers: number;
    hires: number;
    conversionRate: number;
  }>;
}

export function SourceAnalyticsCard({ analytics }: SourceAnalyticsCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-blue-600" />
          <CardTitle>Source Analytics</CardTitle>
        </div>
        <CardDescription>Effectiveness by candidate source</CardDescription>
      </CardHeader>
      <CardContent>
        {analytics.length === 0 ? (
          <p className="text-sm text-slate-500">No source data available</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Source
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Applications
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Interviews
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Offers
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Hires
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Conversion
                  </th>
                </tr>
              </thead>
              <tbody>
                {analytics.map((source) => (
                  <tr
                    key={source.source}
                    className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                  >
                    <td className="py-3 px-4 text-sm font-medium text-slate-900 capitalize">
                      {source.source.replace(/_/g, " ")}
                    </td>
                    <td className="py-3 px-4 text-sm text-right text-slate-700">
                      {source.applications}
                    </td>
                    <td className="py-3 px-4 text-sm text-right text-slate-700">
                      {source.interviews}
                    </td>
                    <td className="py-3 px-4 text-sm text-right text-slate-700">
                      {source.offers}
                    </td>
                    <td className="py-3 px-4 text-sm text-right">
                      <Badge variant={source.hires > 0 ? "default" : "outline"}>
                        {source.hires}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-sm text-right">
                      <span
                        className={
                          source.conversionRate >= 20
                            ? "text-green-600 font-medium"
                            : source.conversionRate >= 10
                            ? "text-amber-600"
                            : "text-slate-600"
                        }
                      >
                        {source.conversionRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
