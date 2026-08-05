import { listEmployeeOptionsCached } from "@/lib/recruitment/job/queries";

/** Active employee options for recruitment forms (cached; matches job/candidate paths). */
export async function getEmployeeOptions() {
  return listEmployeeOptionsCached();
}
