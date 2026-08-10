"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/error-alert";
import { ConversionChecklist } from "./conversion-checklist";
import { ConversionSummaryCard } from "./conversion-summary-card";
import { EmployeePreviewCard } from "./employee-preview-card";
import { convertEmployeeAction } from "@/actions/recruitment-conversions";
import type {
  EmployeeConversionFormData,
  EmployeeConversionFormField,
  EmployeeConversionPreviewData,
} from "@/lib/recruitment/conversion/types";
import { ArrowLeft, UserCheck } from "lucide-react";
import Link from "next/link";

interface ConversionPreviewProps {
  previewData: {
    candidate: {
      id: string;
      fullName: string;
      email: string | null;
      phone: string | null;
      status: string;
    };
    application?: {
      id: string;
      jobOpeningId: string;
      jobTitle: string;
      currentStage: string;
    } | null;
    offer: {
      id: string;
      offerNumber: string | null;
      status: string;
      ctc: number;
      currency: string;
      joiningDate: string;
      department: string;
      location: string;
    };
    employeePreview: EmployeeConversionPreviewData;
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
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<EmployeeConversionFormData>({
    ...previewData.employeePreview,
    createLogin: false,
    password: "",
  });

  const handleFieldChange = <K extends EmployeeConversionFormField>(
    field: K,
    value: EmployeeConversionFormData[K]
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const hasBlockingErrors = previewData.blockingErrors.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasBlockingErrors) {
      setError("Please resolve all blocking checklist issues before converting.");
      return;
    }

    startTransition(async () => {
      setError(null);
      const result = await convertEmployeeAction(
        {},
        {
          offerId: previewData.offer.id,
          employeeCode: formData.employeeCode,
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          department: formData.department,
          designation: formData.designation,
          managerId: formData.managerId,
          employmentType: formData.employmentType,
          workLocation: formData.workLocation,
          joiningDate: formData.joiningDate,
          grade: formData.grade,
          ctc: formData.ctc,
          createLogin: formData.createLogin,
          password: formData.password || null,
        }
      );

      if (result.error) {
        setError(result.error);
      } else if (result.success && result.employeeId) {
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

      {error ? <ErrorAlert message={error} /> : null}

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
              loading={isPending}
              disabled={hasBlockingErrors}
            >
              {isPending ? (
                "Converting…"
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
