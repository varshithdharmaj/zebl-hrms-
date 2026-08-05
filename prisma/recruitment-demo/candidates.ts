import { RecruitmentDocumentType } from "@/generated/prisma/enums";
import { createCandidateService } from "@/lib/recruitment/services/candidate-service";
import { RecruitmentDomainError } from "@/lib/recruitment/shared/errors";
import { CANDIDATES, MIN_CAND_DOMAIN, SOURCE_MAP } from "./catalog";
import { daysAgo, log, type DemoCtx } from "./helpers";

export async function seedCandidates(ctx: DemoCtx): Promise<void> {
  log("Candidates (15) via CandidateService…");
  const svc = createCandidateService();
  const demoTag = await ctx.prisma.recruitmentTag.findUnique({
    where: { name: "__min_demo__" },
  });

  let n = 0;
  for (let i = 0; i < CANDIDATES.length; i++) {
    const c = CANDIDATES[i]!;
    const email = `${c.key}@${MIN_CAND_DOMAIN}`;
    const phone = `+9198${String(20000000 + i * 111).slice(0, 8)}`;
    const src = SOURCE_MAP[c.source];
    const [first, ...rest] = c.name.split(" ");
    const last = rest.join(" ") || "Candidate";

    const existing = await ctx.prisma.candidate.findFirst({
      where: { email, deletedAt: null },
    });
    if (existing) {
      ctx.candidates.set(c.key, {
        id: existing.id,
        email,
        name: existing.fullName,
      });
      n += 1;
      continue;
    }

    try {
      const { id } = await svc.createCandidate(ctx.session, {
        fullName: c.name,
        firstName: first,
        lastName: last,
        email,
        phone,
        location: c.city,
        currentCompany: c.years === 0 ? null : "Infosys",
        currentTitle: c.years === 0 ? "Fresher" : "Software Engineer",
        source: src.enum,
        currency: "INR",
        currentCtc: c.years === 0 ? null : String(400000 + c.years * 200000),
        expectedCtc: String(600000 + c.years * 220000),
        noticePeriodDays: c.years === 0 ? 0 : 30,
        primaryRecruiterUserId: ctx.staff.get(i % 2 === 0 ? "rec_1" : "rec_2")!.userId,
        personal: {
          currentLocation: c.city,
          preferredLocation: c.city,
          nationality: "Indian",
          linkedinUrl: `https://linkedin.com/in/${c.key}`,
        },
        experiences:
          c.years === 0
            ? []
            : [
                {
                  company: "Infosys",
                  title: "Engineer",
                  location: c.city,
                  isCurrent: true,
                  description: `${c.years}y delivery experience.`,
                  sortOrder: 0,
                },
              ],
        educations: [
          {
            institution: "NIT Warangal",
            degree: "B.Tech",
            field: "Computer Science",
            startYear: 2014,
            endYear: 2018,
            sortOrder: 0,
          },
        ],
        skills: [
          { name: "TypeScript", proficiency: "advanced", yearsOfExperience: Math.max(1, c.years) },
          { name: "React", proficiency: "intermediate", yearsOfExperience: Math.max(1, c.years - 1) },
        ],
        documents: [
          {
            documentType: RecruitmentDocumentType.resume,
            fileName: `${c.key}_Resume.pdf`,
            mimeType: "application/pdf",
            sizeBytes: 160000,
            storageKey: `demo/min/${c.key}/resume.pdf`,
            checksum: `min-${c.key}-resume`,
            isPrimary: true,
          },
        ],
        notes: [
          {
            body: `[Demo] ${c.purpose} · sourced via ${c.source}`,
            visibility: "team",
            authorUserId: ctx.session.id,
          },
        ],
      });

      // Spread createdAt for 7/30/90-day trends
      const age = c.purpose === "hired" || c.purpose === "offer_accepted" ? 45 + i : 5 + i * 5;
      await ctx.prisma.candidate.update({
        where: { id },
        data: { createdAt: daysAgo(Math.min(age, 85), 9) },
      });

      if (demoTag) {
        const st = await ctx.prisma.recruitmentTag.findUnique({ where: { name: src.tag } });
        await ctx.prisma.candidateTag.createMany({
          data: [
            { candidateId: id, tagId: demoTag.id },
            ...(st ? [{ candidateId: id, tagId: st.id }] : []),
          ],
          skipDuplicates: true,
        });
      }

      ctx.candidates.set(c.key, { id, email, name: c.name });
      n += 1;
    } catch (err) {
      if (err instanceof RecruitmentDomainError && err.code === "REC_CONFLICT") {
        const found = await ctx.prisma.candidate.findFirst({ where: { email } });
        if (found) {
          ctx.candidates.set(c.key, { id: found.id, email, name: found.fullName });
          n += 1;
          continue;
        }
      }
      throw err;
    }
  }

  // Duplicate prevention probe (must fail)
  try {
    await svc.createCandidate(ctx.session, {
      fullName: "Duplicate Probe",
      email: `c01@${MIN_CAND_DOMAIN}`,
      source: "manual",
    });
  } catch {
    /* expected REC_CONFLICT */
  }

  ctx.counts.candidates = n;
}
