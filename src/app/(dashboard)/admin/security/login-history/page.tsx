import { redirect } from "next/navigation";

export default async function AdminLoginHistoryRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && value) qs.set(key, value);
  }
  const query = qs.toString();
  redirect(query ? `/admin/security?${query}` : "/admin/security");
}
