import type { CandidateDetail } from "@/lib/recruitment/candidate/types";
import {
  displayValue,
  normalizeComparable,
} from "@/lib/recruitment/resume-import/draft-content";
import type {
  FieldDiffStatus,
  ResumeImportDraftContent,
  ScalarFieldDiff,
  SectionDiff,
} from "@/lib/recruitment/resume-import/types";

function classifyScalar(
  current: string | null,
  imported: string | null
): FieldDiffStatus {
  if (!imported && !current) return "unchanged";
  if (imported && !current) return "new";
  if (!imported && current) return "missing";
  if (normalizeComparable(current) === normalizeComparable(imported)) return "unchanged";
  return "conflict";
}

function sectionPreview(rows: unknown[], pick: (row: Record<string, unknown>) => string): string {
  if (rows.length === 0) return "—";
  return rows
    .slice(0, 3)
    .map((row) => {
      if (typeof row !== "object" || !row) return "—";
      return pick(row as Record<string, unknown>);
    })
    .join(" · ");
}

export function buildResumeImportDiffs(
  candidate: CandidateDetail,
  content: ResumeImportDraftContent
): { scalars: ScalarFieldDiff[]; sections: SectionDiff[] } {
  const { personal, professional } = content.mapped;

  const scalarDefs: Array<{
    key: string;
    label: string;
    group: "personal" | "professional";
    current: unknown;
    imported: unknown;
  }> = [
    {
      key: "fullName",
      label: "Full name",
      group: "personal",
      current: candidate.fullName,
      imported: personal.fullName,
    },
    {
      key: "firstName",
      label: "First name",
      group: "personal",
      current: candidate.firstName,
      imported: personal.firstName,
    },
    {
      key: "lastName",
      label: "Last name",
      group: "personal",
      current: candidate.lastName,
      imported: personal.lastName,
    },
    {
      key: "email",
      label: "Email",
      group: "personal",
      current: candidate.email,
      imported: personal.email,
    },
    {
      key: "phone",
      label: "Phone",
      group: "personal",
      current: candidate.phone,
      imported: personal.phone,
    },
    {
      key: "location",
      label: "Location",
      group: "personal",
      current: candidate.location,
      imported: personal.location,
    },
    {
      key: "headline",
      label: "Headline",
      group: "professional",
      current: candidate.headline,
      imported: professional.headline,
    },
    {
      key: "professionalSummary",
      label: "Professional summary",
      group: "professional",
      current: candidate.professionalSummary,
      imported: professional.professionalSummary,
    },
    {
      key: "currentCompany",
      label: "Current company",
      group: "professional",
      current: candidate.currentCompany,
      imported: professional.currentCompany,
    },
    {
      key: "currentTitle",
      label: "Current title",
      group: "professional",
      current: candidate.currentTitle,
      imported: professional.currentTitle,
    },
    {
      key: "githubUrl",
      label: "GitHub",
      group: "professional",
      current: candidate.githubUrl,
      imported: professional.githubUrl,
    },
    {
      key: "linkedinUrl",
      label: "LinkedIn",
      group: "professional",
      current: candidate.linkedinUrl,
      imported: professional.linkedinUrl,
    },
    {
      key: "portfolioUrl",
      label: "Portfolio",
      group: "professional",
      current: candidate.personal?.portfolioUrl,
      imported: professional.portfolioUrl,
    },
    {
      key: "totalExperienceYears",
      label: "Total experience (years)",
      group: "professional",
      current: candidate.totalExperienceYears,
      imported: professional.totalExperienceYears,
    },
    {
      key: "preferredWorkMode",
      label: "Preferred work mode",
      group: "professional",
      current: candidate.preferredWorkMode,
      imported: professional.preferredWorkMode,
    },
    {
      key: "willingToRelocate",
      label: "Willing to relocate",
      group: "professional",
      current: candidate.willingToRelocate,
      imported: professional.willingToRelocate,
    },
  ];

  const scalars: ScalarFieldDiff[] = scalarDefs.map((def) => {
    const current = displayValue(def.current);
    const imported = displayValue(def.imported);
    const status = classifyScalar(current, imported);
    const confKey =
      def.group === "personal"
        ? `personal.${def.key}`
        : `professional.${def.key}`;
    return {
      key: def.key,
      label: def.label,
      group: def.group,
      current,
      imported,
      status: status === "conflict" && current && imported ? "conflict" : status === "conflict" ? "changed" : status,
      confidence: content.fieldConfidence[confKey],
    };
  });

  const sectionDefs: Array<{
    section: SectionDiff["section"];
    label: string;
    currentRows: unknown[];
    importedRows: unknown[];
    pick: (row: Record<string, unknown>) => string;
  }> = [
    {
      section: "experiences",
      label: "Experience",
      currentRows: candidate.experiences ?? [],
      importedRows: content.mapped.experiences,
      pick: (r) => `${String(r.title ?? "")} @ ${String(r.company ?? r.companyName ?? "")}`.trim(),
    },
    {
      section: "educations",
      label: "Education",
      currentRows: candidate.educations ?? [],
      importedRows: content.mapped.educations,
      pick: (r) => `${String(r.degree ?? "")} · ${String(r.institution ?? "")}`.trim(),
    },
    {
      section: "skills",
      label: "Skills",
      currentRows: candidate.skills ?? [],
      importedRows: content.mapped.skills,
      pick: (r) => String(r.name ?? r.skillName ?? ""),
    },
    {
      section: "projects",
      label: "Projects",
      currentRows: candidate.projects ?? [],
      importedRows: content.mapped.projects,
      pick: (r) => String(r.title ?? ""),
    },
    {
      section: "certifications",
      label: "Certifications",
      currentRows: candidate.certifications ?? [],
      importedRows: content.mapped.certifications,
      pick: (r) => String(r.name ?? ""),
    },
  ];

  const sections: SectionDiff[] = sectionDefs.map((def) => {
    const currentCount = def.currentRows.length;
    const importedCount = def.importedRows.length;
    let status: SectionDiff["status"] = "unchanged";
    if (importedCount > 0 && currentCount === 0) status = "new";
    else if (importedCount === 0 && currentCount > 0) status = "missing";
    else if (importedCount !== currentCount) status = "changed";
    else if (
      normalizeComparable(sectionPreview(def.currentRows, def.pick)) !==
      normalizeComparable(sectionPreview(def.importedRows, def.pick))
    ) {
      status = "changed";
    }

    return {
      section: def.section,
      label: def.label,
      currentCount,
      importedCount,
      status,
      currentPreview: sectionPreview(def.currentRows, def.pick),
      importedPreview: sectionPreview(def.importedRows, def.pick),
    };
  });

  return { scalars, sections };
}
