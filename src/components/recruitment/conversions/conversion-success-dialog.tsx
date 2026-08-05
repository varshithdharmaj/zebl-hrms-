import React from "react";
import { Dialog, DialogContent, CardHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, User, ArrowRight } from "lucide-react";
import Link from "next/link";

interface SuccessDialogProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId: number | null;
  employeeCode: string;
  employeeName: string;
}

export function ConversionSuccessDialog({
  isOpen,
  onClose,
  employeeId,
  employeeCode,
  employeeName,
}: SuccessDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md rounded-xl">
        <div className="flex flex-col items-center text-center space-y-4 py-4">
          <div className="rounded-full bg-emerald-50 p-3">
            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
          </div>
          <div className="space-y-2">
            <DialogTitle className="text-lg font-bold text-slate-900">
              Conversion Successful!
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 max-w-xs">
              {employeeName} has been successfully converted into an employee and added to the HRMS database.
            </DialogDescription>
          </div>

          <div className="rounded-lg bg-slate-50 border border-slate-100 p-4 w-full space-y-2 text-left">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 font-medium">Employee Name:</span>
              <span className="text-slate-800 font-bold">{employeeName}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 font-medium">Employee Code:</span>
              <span className="text-slate-800 font-bold">{employeeCode}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 font-medium">HRMS Status:</span>
              <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full text-[10px] uppercase">
                Active
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="sm:justify-between gap-2">
          <Link href="/admin/recruitment/pipeline?focus=conversions" className="w-full sm:w-auto">
            <Button variant="outline" size="sm" className="w-full text-xs rounded-lg">
              Back to Workspace
            </Button>
          </Link>
          {employeeId && (
            <Link href={`/admin/employees`} className="w-full sm:w-auto">
              <Button size="sm" className="w-full text-xs rounded-lg gap-1.5 font-semibold">
                <User className="h-4 w-4" /> View Employee Directory <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
