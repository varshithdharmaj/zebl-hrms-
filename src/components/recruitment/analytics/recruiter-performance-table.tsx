import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Award } from "lucide-react";

interface RecruiterPerformanceTableProps {
  performance: Array<{
    recruiterId: string;
    recruiterEmail: string;
    openJobs: number;
    candidates: number;
    interviews: number;
    offers: number;
    hires: number;
    acceptanceRate: number;
    avgTimeToHire: number;
  }>;
}

export function RecruiterPerformanceTable({ performance }: RecruiterPerformanceTableProps) {
  const topPerformer = performance.reduce((prev, current) =>
    current.hires > prev.hires ? current : prev
  , performance[0] || null);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-blue-600" />
          <CardTitle>Recruiter Performance</CardTitle>
        </div>
        <CardDescription>Performance metrics per recruiter</CardDescription>
      </CardHeader>
      <CardContent>
        {performance.length === 0 ? (
          <p className="text-sm text-slate-500">No recruiter data available</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Recruiter
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Open Jobs
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Candidates
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
                    Acceptance %
                  </th>
                </tr>
              </thead>
              <tbody>
                {performance.map((recruiter) => (
                  <tr
                    key={recruiter.recruiterId}
                    className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                  >
                    <td className="py-3 px-4 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">
                          {recruiter.recruiterEmail}
                        </span>
                        {topPerformer?.recruiterId === recruiter.recruiterId && recruiter.hires > 0 && (
                          <Award className="h-4 w-4 text-amber-500" title="Top Performer" />
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-right text-slate-700">
                      {recruiter.openJobs}
                    </td>
                    <td className="py-3 px-4 text-sm text-right text-slate-700">
                      {recruiter.candidates}
                    </td>
                    <td className="py-3 px-4 text-sm text-right text-slate-700">
                      {recruiter.interviews}
                    </td>
                    <td className="py-3 px-4 text-sm text-right text-slate-700">
                      {recruiter.offers}
                    </td>
                    <td className="py-3 px-4 text-sm text-right">
                      <Badge variant={recruiter.hires > 0 ? "default" : "outline"}>
                        {recruiter.hires}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-sm text-right">
                      <span
                        className={
                          recruiter.acceptanceRate >= 80
                            ? "text-green-600 font-medium"
                            : recruiter.acceptanceRate >= 50
                            ? "text-amber-600"
                            : "text-slate-600"
                        }
                      >
                        {recruiter.acceptanceRate}%
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
