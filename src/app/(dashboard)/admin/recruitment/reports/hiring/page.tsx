import { ReportSectionPage } from "@/components/recruitment/reports/load-report-page";

export default function HiringReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <ReportSectionPage
      section="hiring"
      title="Hiring Reports"
      description="Hiring funnel, recruiter performance, department hiring, pipeline aging, sources, and time metrics."
      searchParams={searchParams}
    />
  );
}
