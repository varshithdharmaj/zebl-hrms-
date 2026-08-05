import { ReportSectionPage } from "@/components/recruitment/reports/load-report-page";

export default function CommunicationReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <ReportSectionPage
      section="communications"
      title="Communication Reports"
      description="Communication summary including volume, drafts, templates, and recruiter activity."
      searchParams={searchParams}
    />
  );
}
