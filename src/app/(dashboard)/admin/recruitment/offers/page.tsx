import { redirect } from "next/navigation";

export default function RecruitmentOffersPage() {
  redirect("/admin/recruitment/pipeline?focus=offers");
}
