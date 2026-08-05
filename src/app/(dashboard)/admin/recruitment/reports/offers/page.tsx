import { ReportSectionPage } from "@/components/recruitment/reports/load-report-page";

export default function OfferReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <ReportSectionPage
      section="offers"
      title="Offer Reports"
      description="Offer summary outcomes across the hiring pipeline."
      searchParams={searchParams}
    />
  );
}
