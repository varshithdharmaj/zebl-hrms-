import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ListPageSkeleton } from "@/components/loading";
import { isRecruitmentModuleEnabled } from "@/lib/recruitment/config/feature-flags";

export default function RecruitmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isRecruitmentModuleEnabled()) {
    notFound();
  }

  return (
    <Suspense fallback={<ListPageSkeleton label="Loading recruitment" showKpis />}>
      {children}
    </Suspense>
  );
}
