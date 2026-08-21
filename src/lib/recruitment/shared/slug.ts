/** No slugify utility existed anywhere in the repo prior to public /apply — see Phase 1 audit. */

const MAX_SLUG_LENGTH = 80;

/** Lowercase, ASCII, hyphen-separated. No internal IDs, no reserved punctuation. */
export function slugifyJobTitle(title: string): string {
  const base = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");
  return base || "job";
}

/** Appends -2, -3, ... until `exists` reports the candidate is free. */
export async function generateUniqueJobSlug(
  title: string,
  exists: (candidate: string) => Promise<boolean>
): Promise<string> {
  const base = slugifyJobTitle(title);
  let candidate = base;
  let suffix = 2;
  // Bounded — a job title colliding 500 times over is not a real scenario;
  // this guards against an exists() implementation bug looping forever.
  while ((await exists(candidate)) && suffix < 500) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}
