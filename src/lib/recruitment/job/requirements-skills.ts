const SKILLS_MARKER = "\n\n## Skills\n";

export function composeRequirements(
  requirements: string | null | undefined,
  skills: string | null | undefined
): string | null {
  const req = requirements?.trim() ?? "";
  const sk = skills?.trim() ?? "";
  if (!req && !sk) return null;
  if (!sk) return req || null;
  if (!req) return `## Skills\n${sk}`;
  return `${req}${SKILLS_MARKER}${sk}`;
}

export function splitRequirements(requirements: string | null | undefined): {
  requirements: string | null;
  skillsText: string | null;
} {
  if (!requirements) return { requirements: null, skillsText: null };
  const idx = requirements.indexOf(SKILLS_MARKER);
  if (idx >= 0) {
    return {
      requirements: requirements.slice(0, idx).trim() || null,
      skillsText: requirements.slice(idx + SKILLS_MARKER.length).trim() || null,
    };
  }
  if (requirements.startsWith("## Skills\n")) {
    return {
      requirements: null,
      skillsText: requirements.slice("## Skills\n".length).trim() || null,
    };
  }
  return { requirements: requirements.trim() || null, skillsText: null };
}
