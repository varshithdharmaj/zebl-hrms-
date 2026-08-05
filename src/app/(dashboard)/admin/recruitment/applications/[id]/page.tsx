import { notFound } from "next/navigation";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { ApplicationDetailView } from "@/components/recruitment/applications/application-detail";
import { requireHROrSuperAdminSession } from "@/lib/auth-guards";
import { getApplicationCached } from "@/lib/recruitment/application";
import { getEmployeeOptions } from "@/lib/recruitment/candidate";
import { listInterviewsCached } from "@/lib/recruitment/interview/queries";
import { prismaOfferRepository } from "@/lib/recruitment/repositories/prisma-offer-repository";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Edit } from "lucide-react";

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireHROrSuperAdminSession();
  const { id } = await params;

  const app = await getApplicationCached(session, id);
  if (!app) {
    notFound();
  }

  const employeeOptions = await getEmployeeOptions();

  // Fetch interviews for this application
  const interviewsResult = await listInterviewsCached(
    session,
    { applicationId: id },
    { page: 1, pageSize: 100 }
  );
  const interviews = interviewsResult.items;

  // Fetch offers for this application
  const offers = await prismaOfferRepository.listByApplication(id);

  return (
    <div className="space-y-6 lg:space-y-8">
      <WorkspacePageHeader
        title={`${app.candidate.fullName}'s Application`}
        description={`Track progress for ${app.candidate.fullName} applying for ${app.jobOpening.title}.`}
        action={
          <Button asChild variant="outline" className="font-semibold shadow-subtle flex items-center gap-1.5">
            <Link href={`/admin/recruitment/applications/${app.id}/edit`}>
              <Edit className="h-4 w-4 text-muted-foreground" />
              Edit Application
            </Link>
          </Button>
        }
      />

      <ApplicationDetailView
        application={app}
        employeeOptions={employeeOptions}
        interviews={interviews}
        offers={offers}
      />
    </div>
  );
}
