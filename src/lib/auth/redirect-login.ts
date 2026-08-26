import { redirect } from "next/navigation";

/** Redirect to login; middleware clears stale cookies when `clear=1` is present. */
export function redirectToLogin(): never {
  redirect("/login?clear=1");
}
