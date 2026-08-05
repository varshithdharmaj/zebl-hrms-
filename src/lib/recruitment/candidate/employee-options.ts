"use server";

import { listEmployeeOptionsCached } from "@/lib/recruitment/job/queries";

export async function getEmployeeOptions() {
  return listEmployeeOptionsCached();
}
