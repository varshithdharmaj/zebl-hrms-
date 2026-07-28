import { redirect } from "next/navigation";

export default function EmployeeActiveSessionsRedirect() {
  redirect("/employee/security");
}
