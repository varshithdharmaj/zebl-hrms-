import React from "react";
import { requireHROrSuperAdminSession } from "@/lib/auth-guards";
import { previewConversionCached } from "@/lib/recruitment/conversion/queries";
import { ConversionPreview } from "@/components/recruitment/conversions/conversion-preview";
import { prisma } from "@/lib/prisma";

export default async function RecruitmentConversionDetailPage({
  params,
}: {
  params: Promise<{ offerId: string }>;
}) {
  const session = await requireHROrSuperAdminSession();
  const { offerId } = await params;

  // Fetch preview data
  const previewData = await previewConversionCached(session, offerId);

  // Fetch potential reporting managers
  const managers = await prisma.employee.findMany({
    where: {
      employeeStatus: "Active",
    },
    select: {
      id: true,
      name: true,
      employeeCode: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  return (
    <div className="space-y-6 lg:space-y-8">
      <ConversionPreview
        previewData={previewData}
        managers={managers}
      />
    </div>
  );
}
