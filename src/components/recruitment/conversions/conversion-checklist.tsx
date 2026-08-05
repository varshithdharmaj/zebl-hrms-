import React from "react";
import { CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ChecklistProps {
  checklist: {
    offerAccepted: boolean;
    candidateActive: boolean;
    noDuplicateEmployee: boolean;
    joiningDateValid: boolean;
    departmentExists: boolean;
    managerExists: boolean;
  };
  blockingErrors: string[];
}

export function ConversionChecklist({ checklist, blockingErrors }: ChecklistProps) {
  const items = [
    {
      label: "Offer Accepted",
      description: "The offer must be accepted by the candidate.",
      status: checklist.offerAccepted,
    },
    {
      label: "Candidate Active",
      description: "The candidate profile must be active.",
      status: checklist.candidateActive,
    },
    {
      label: "No Duplicate Employee",
      description: "No employee with the same email or code should exist.",
      status: checklist.noDuplicateEmployee,
    },
    {
      label: "Joining Date Valid",
      description: "A valid joining date must be set on the offer.",
      status: checklist.joiningDateValid,
    },
    {
      label: "Department Exists",
      description: "A department must be assigned to the offer.",
      status: checklist.departmentExists,
    },
    {
      label: "Manager Assigned",
      description: "A reporting manager should be assigned if required.",
      status: checklist.managerExists,
    },
  ];

  const hasErrors = blockingErrors.length > 0;

  return (
    <Card className="shadow-subtle border-slate-200">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
          Conversion Readiness Checklist
        </CardTitle>
        <CardDescription className="text-xs text-slate-500">
          Verify all system requirements are met before converting this candidate.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasErrors && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3.5 space-y-2">
            <div className="flex items-center gap-2 text-red-800 font-semibold text-xs">
              <XCircle className="h-4 w-4 shrink-0 text-red-600" />
              <span>Blocking Issues Found ({blockingErrors.length})</span>
            </div>
            <ul className="list-disc pl-5 text-xs text-red-700 space-y-1">
              {blockingErrors.map((error, idx) => (
                <li key={idx}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="divide-y divide-slate-100">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-start justify-between py-3 first:pt-0 last:pb-0">
              <div className="space-y-0.5 pr-4">
                <span className="text-xs font-semibold text-slate-800 block">
                  {item.label}
                </span>
                <span className="text-[11px] text-slate-500 block">
                  {item.description}
                </span>
              </div>
              <div className="shrink-0 pt-0.5">
                {item.status ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
