import { DashboardPageSkeleton } from "@/components/loading";

export default function RecruitmentLoading() {
  return <DashboardPageSkeleton label="Loading recruitment" kpiCount={4} showTable={false} />;
}
