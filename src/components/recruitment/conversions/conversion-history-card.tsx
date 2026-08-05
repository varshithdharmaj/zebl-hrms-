import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, User, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface HistoryProps {
  history: any[];
}

export function ConversionHistoryCard({ history }: HistoryProps) {
  if (history.length === 0) {
    return (
      <Card className="shadow-subtle border-slate-200">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-slate-50 p-3 mb-3">
            <User className="h-6 w-6 text-slate-400" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900">No Conversion History</h3>
          <p className="text-xs text-slate-500 max-w-xs mt-1">
            No candidates have been converted to employees yet in this workspace.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-subtle border-slate-200">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold text-slate-900">
          Conversion History
        </CardTitle>
        <CardDescription className="text-xs text-slate-500">
          A complete audit trail of all candidate conversions to HRMS employees.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/75 font-semibold text-slate-600">
              <th className="px-6 py-3 text-xs font-semibold text-slate-600">Candidate</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-600">Job Opening</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-600">Employee Code</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-600">Converted Date</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-600">Converted By</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-600 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {history.map((snapshot) => {
              const candidate = snapshot.application.candidate;
              const job = snapshot.application.jobOpening;
              const employee = snapshot.employee;

              return (
                <tr key={snapshot.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-3">
                    <div className="space-y-0.5">
                      <span className="text-xs font-semibold text-slate-900 block">
                        {candidate.fullName}
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        {candidate.email || "No Email"}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <span className="text-xs font-medium text-slate-800">
                      {job.title}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <Badge variant="secondary" className="text-[10px] font-bold bg-slate-100 text-slate-800 rounded-md">
                      {employee.employeeCode}
                    </Badge>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-1.5 text-xs text-slate-600">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      <span>{new Date(snapshot.convertedAt).toLocaleDateString()}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-1.5 text-xs text-slate-600">
                      <User className="h-3.5 w-3.5 text-slate-400" />
                      <span>{snapshot.convertedBy.email}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <Link href={`/admin/employees`}>
                      <Button variant="ghost" size="sm" className="h-7 text-[10px] font-semibold rounded-md gap-1">
                        View Profile <ArrowUpRight className="h-3 w-3" />
                      </Button>
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
