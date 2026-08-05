import { notFound } from "next/navigation";
import { isRecruitmentModuleEnabled } from "@/lib/recruitment/config/feature-flags";

export default function RecruitmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isRecruitmentModuleEnabled()) {
    notFound();
  }

  return children;
}
