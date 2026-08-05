import { redirect } from "next/navigation";

export default function RecruitmentConversionsPage() {
  redirect("/admin/recruitment/pipeline?focus=conversions");
}
