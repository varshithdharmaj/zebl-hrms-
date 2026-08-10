/**
 * Sidebar active matching.
 * Exact-only for Recruitment Dashboard so child routes do not double-highlight.
 * Pipeline owns /applications* (list redirects; detail is a workflow hop).
 */
const EXACT_MATCH_ONLY = new Set(["/admin/recruitment"]);

export function isSidebarNavActive(
  pathname: string,
  href: string,
  siblingHrefs: readonly string[] = []
): boolean {
  const path = pathname.split("?")[0] ?? pathname;

  if (href === "/admin/recruitment/pipeline") {
    if (
      path === "/admin/recruitment/applications" ||
      path.startsWith("/admin/recruitment/applications/")
    ) {
      return true;
    }
  }

  if (path === href) return true;
  if (EXACT_MATCH_ONLY.has(href)) return false;
  if (!path.startsWith(`${href}/`)) return false;

  return !siblingHrefs.some(
    (other) =>
      other !== href &&
      other.length > href.length &&
      (path === other || path.startsWith(`${other}/`))
  );
}
