import { ReportSectionPage } from "@/components/recruitment/reports/load-report-page";

export default function InterviewReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <ReportSectionPage
      section="interviews"
      title="Interview Reports"
      description="Interview summary outcomes and feedback quality."
      searchParams={searchParams}
    />
  );
}
