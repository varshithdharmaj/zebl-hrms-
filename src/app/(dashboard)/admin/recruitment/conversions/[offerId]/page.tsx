import React from "react";
import { requireHROrSuperAdminSession } from "@/lib/auth-guards";
import { previewConversionCached } from "@/lib/recruitment/conversion/queries";
import { ConversionPreview } from "@/components/recruitment/conversions/conversion-preview";
import { RecruitmentContextHeader } from "@/components/recruitment/shared/recruitment-context-header";
import { prisma } from "@/lib/prisma";
import { buildRecruitmentBreadcrumbs } from "@/lib/recruitment/navigation/breadcrumbs";
import { parseRecruitmentNavSearch } from "@/lib/recruitment/navigation/return-to";

export default async function RecruitmentConversionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ offerId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireHROrSuperAdminSession();
  const { offerId } = await params;
  const nav = parseRecruitmentNavSearch((await searchParams) ?? {});

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
      <RecruitmentContextHeader
        crumbs={buildRecruitmentBreadcrumbs({
          section: "conversions",
          returnTo: nav.returnTo,
          candidate: {
            id: previewData.candidate.id,
            name: previewData.candidate.fullName,
          },
          job: previewData.application?.jobOpeningId
            ? {
                id: previewData.application.jobOpeningId,
                title: previewData.application.jobTitle || "Role",
              }
            : null,
          application: previewData.application
            ? {
                id: previewData.application.id,
                jobTitle: previewData.application.jobTitle,
              }
            : null,
          leafLabel: "Convert to Employee",
        })}
        stage={previewData.application?.currentStage}
      />
      <ConversionPreview
        previewData={previewData}
        managers={managers}
      />
    </div>
  );
}
