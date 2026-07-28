import { redirect } from "next/navigation";

export default function AdminActiveSessionsRedirect() {
  redirect("/admin/security");
}
