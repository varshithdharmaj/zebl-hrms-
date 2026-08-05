"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConversionChecklist } from "./conversion-checklist";
import { ConversionSummaryCard } from "./conversion-summary-card";
import { EmployeePreviewCard } from "./employee-preview-card";
import { ConversionSuccessDialog } from "./conversion-success-dialog";
import { convertEmployeeAction } from "@/actions/recruitment-conversions";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, UserCheck, Loader2 } from "lucide-react";
import Link from "next/link";

interface ConversionPreviewProps {
  previewData: {
    candidate: any;
    offer: any;
    employeePreview: any;
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

  const [successData, setSuccessData] = useState<{
    isOpen: boolean;
    employeeId: number | null;
    employeeCode: string;
    employeeName: string;
  }>({
    isOpen: false,
    employeeId: null,
    employeeCode: "",
    employeeName: "",
  });

  const handleFieldChange = (field: string, value: any) => {
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
      const result = await convertEmployeeAction({}, {
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
      });

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
        setSuccessData({
          isOpen: true,
          employeeId: result.employeeId,
          employeeCode: formData.employeeCode,
          employeeName: formData.name,
        });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/recruitment/pipeline?focus=conversions">
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
        {/* Left 2 Columns: Editable Setup */}
        <div className="lg:col-span-2 space-y-6">
          <EmployeePreviewCard
            formData={formData}
            onChange={handleFieldChange}
            managers={managers}
          />

          <div className="flex justify-end gap-3">
            <Link href="/admin/recruitment/pipeline?focus=conversions">
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

        {/* Right 1 Column: Summary & Checklist */}
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

      <ConversionSuccessDialog
        isOpen={successData.isOpen}
        onClose={() => setSuccessData((prev) => ({ ...prev, isOpen: false }))}
        employeeId={successData.employeeId}
        employeeCode={successData.employeeCode}
        employeeName={successData.employeeName}
      />
    </div>
  );
}
