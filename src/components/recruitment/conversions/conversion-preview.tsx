"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConversionChecklist } from "./conversion-checklist";
import { ConversionSummaryCard } from "./conversion-summary-card";
import { EmployeePreviewCard } from "./employee-preview-card";
import { convertEmployeeAction } from "@/actions/recruitment-conversions";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, UserCheck, Loader2 } from "lucide-react";
import Link from "next/link";

interface ConversionPreviewProps {
  previewData: {
    candidate: { id: string; fullName: string };
    offer: { id: string };
    employeePreview: Record<string, unknown>;
    checklist: {
      offerAccepted: boolean;
      candidateActive: boolean;
      noDuplicateEmployee: boolean;
      joiningDateValid: boolean;
      departmentExists: boolean;
      managerExists: boolean;
    };
    blockingErrors: string[];
  };
  managers: { id: number; name: string; employeeCode: string }[];
}

export function ConversionPreview({ previewData, managers }: ConversionPreviewProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [formData, setFormData] = useState({
    ...previewData.employeePreview,
    createLogin: false,
    password: "",
  });

  const handleFieldChange = (field: string, value: unknown) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const hasBlockingErrors = previewData.blockingErrors.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasBlockingErrors) {
      toast({
        variant: "destructive",
        title: "Conversion Blocked",
        description: "Please resolve all blocking checklist issues before converting.",
      });
      return;
    }

    startTransition(async () => {
      const result = await convertEmployeeAction(
        {},
        {
          offerId: previewData.offer.id,
          employeeCode: String(formData.employeeCode ?? ""),
          name: String(formData.name ?? ""),
          email: formData.email as string | null | undefined,
          phone: formData.phone as string | null | undefined,
          department: String(formData.department ?? ""),
          designation: String(formData.designation ?? ""),
          managerId: formData.managerId as number | null | undefined,
          employmentType: String(formData.employmentType ?? ""),
          workLocation: String(formData.workLocation ?? ""),
          joiningDate: String(formData.joiningDate ?? ""),
          grade: formData.grade as string | null | undefined,
          ctc: Number(formData.ctc ?? 0),
          createLogin: Boolean(formData.createLogin),
          password: (formData.password as string) || null,
        }
      );

      if (result.error) {
        toast({
          variant: "destructive",
          title: "Conversion Failed",
          description: result.error,
        });
      } else if (result.success && result.employeeId) {
        toast({
          title: "Success",
          description: "Candidate converted successfully!",
        });
        router.push(
          `/admin/recruitment/conversions/success?employeeId=${result.employeeId}&candidateId=${encodeURIComponent(previewData.candidate.id)}`
        );
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/recruitment/conversions">
          <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Convert Candidate: {previewData.candidate.fullName}
          </h2>
          <p className="text-xs text-slate-500">
            Finalize recruitment and provision their employee record in the HRMS.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <EmployeePreviewCard
            formData={formData}
            onChange={handleFieldChange}
            managers={managers}
          />

          <div className="flex justify-end gap-3">
            <Link href="/admin/recruitment/conversions">
              <Button type="button" variant="outline" size="sm" className="text-xs rounded-lg">
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              size="sm"
              className="text-xs rounded-lg gap-1.5 font-semibold"
              disabled={isPending || hasBlockingErrors}
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Converting...
                </>
              ) : (
                <>
                  <UserCheck className="h-4 w-4" /> Complete Conversion
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          <ConversionChecklist
            checklist={previewData.checklist}
            blockingErrors={previewData.blockingErrors}
          />
          <ConversionSummaryCard
            candidate={previewData.candidate}
            offer={previewData.offer}
          />
        </div>
      </form>
    </div>
  );
}
