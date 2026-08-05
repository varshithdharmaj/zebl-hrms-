import { ReportSectionPage } from "@/components/recruitment/reports/load-report-page";

export default function ConversionReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <ReportSectionPage
      section="conversions"
      title="Conversion Reports"
      description="Employee conversion summary from accepted offers to joined employees."
      searchParams={searchParams}
    />
  );
}
