import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRecruitmentAdminSession } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { Button } from "@/components/ui/button";
import { CheckCircle2, User, ArrowLeft, Users } from "lucide-react";

export default async function ConversionSuccessPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRecruitmentAdminSession();
  const raw = await searchParams;
  const employeeIdRaw = Array.isArray(raw.employeeId) ? raw.employeeId[0] : raw.employeeId;
  const candidateIdRaw = Array.isArray(raw.candidateId) ? raw.candidateId[0] : raw.candidateId;
  const employeeId = employeeIdRaw ? Number.parseInt(employeeIdRaw, 10) : NaN;

  if (!Number.isFinite(employeeId)) {
    notFound();
  }

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      id: true,
      employeeCode: true,
      name: true,
      department: true,
      designation: true,
      email: true,
    },
  });

  if (!employee) {
    notFound();
  }

  const snapshot = await prisma.employeeConversionSnapshot.findFirst({
    where: { employeeId: employee.id },
    select: { mappedFields: true, candidateId: true },
  });

  const mapped =
    snapshot?.mappedFields && typeof snapshot.mappedFields === "object"
      ? (snapshot.mappedFields as { employeeDocuments?: Array<{ kind: string }> })
      : null;
  const docsCopied = mapped?.employeeDocuments?.map((d) => d.kind) ?? [];
  const candidateId = candidateIdRaw || snapshot?.candidateId;

  return (
    <div className="mx-auto max-w-2xl space-y-6 lg:space-y-8">
      <WorkspacePageHeader
        title="Candidate Converted Successfully"
        description="Recruitment closed for this hire. The employee record is ready in the HRMS."
      />

      <div className="rounded-xl border border-border bg-card p-8 shadow-subtle text-center space-y-6">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        </div>

        <div className="space-y-1">
          <h2 className="text-xl font-bold text-foreground">{employee.name}</h2>
          <p className="text-sm text-muted-foreground">is now an active employee</p>
        </div>

        <div className="rounded-lg border border-border bg-muted/10 p-4 text-left space-y-2.5 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Employee ID</span>
            <span className="font-bold font-mono">{employee.employeeCode}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Employee Name</span>
            <span className="font-semibold">{employee.name}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Department</span>
            <span className="font-semibold">{employee.department || "—"}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Job Title</span>
            <span className="font-semibold">{employee.designation || "—"}</span>
          </div>
          {docsCopied.length > 0 ? (
            <div className="flex justify-between gap-3 pt-2 border-t border-border/60">
              <span className="text-muted-foreground">Documents copied</span>
              <span className="font-semibold capitalize">{docsCopied.join(", ")}</span>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
          <Button asChild className="font-semibold gap-1.5">
            <Link href={`/admin/employees/${employee.id}`}>
              <User className="h-4 w-4" /> Open Employee Profile
            </Link>
          </Button>
          <Button asChild variant="outline" className="font-semibold gap-1.5">
            <Link href="/admin/recruitment">
              <ArrowLeft className="h-4 w-4" /> Back to Recruitment
            </Link>
          </Button>
          {candidateId ? (
            <Button asChild variant="ghost" className="font-semibold gap-1.5">
              <Link href={`/admin/recruitment/candidates/${candidateId}`}>
                <Users className="h-4 w-4" /> Open Candidate
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
