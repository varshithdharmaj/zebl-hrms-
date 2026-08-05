import {
  CandidateSource,
  CandidateStatus,
  Prisma,
} from "@/generated/prisma/client";
import {
  CANDIDATE_EMAIL_DOMAIN,
  COMPANIES,
  DEMO_TAG,
  FIRST_NAMES,
  LAST_NAMES,
  LOCATIONS,
  SKILLS_BY_DEPT,
  SOURCE_CATALOG,
  TARGETS,
} from "./constants";
import type { DemoCandidateRef, DemoSeedContext } from "./context";
import {
  chunk,
  daysAgo,
  indianPhone,
  logStep,
  normalizeEmail,
  normalizePhone,
  pick,
  pickN,
} from "./helpers";

export async function seedCandidates(ctx: DemoSeedContext): Promise<void> {
  logStep(`Seeding ${TARGETS.candidates} candidates…`);
  const { prisma, rng, recruiters, demoTagId, tagIds, jobs } = ctx;
  const candidates: DemoCandidateRef[] = [];

  type RecordRow = {
    fullName: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    source: CandidateSource;
    sourceLabel: string;
    sourceTag: string;
    location: string;
    currentCompany: string;
    currentTitle: string;
    years: number;
    currentCtc: number;
    expectedCtc: number;
    notice: number;
    recruiterUserId: string;
    createdAt: Date;
    departmentHint: string;
    index: number;
  };

  const records: RecordRow[] = [];

  for (let i = 0; i < TARGETS.candidates; i++) {
    const first = FIRST_NAMES[i % FIRST_NAMES.length]!;
    const last = LAST_NAMES[(i * 7) % LAST_NAMES.length]!;
    const fullName = `${first} ${last}`;
    const email = normalizeEmail(`demo.cand.${String(i + 1).padStart(4, "0")}@${CANDIDATE_EMAIL_DOMAIN}`);
    const phone = indianPhone(rng, i);
    const src = SOURCE_CATALOG[i % SOURCE_CATALOG.length]!;
    const jobHint = jobs[i % Math.max(jobs.length, 1)];
    const departmentHint = jobHint?.department ?? "Engineering";
    const years = 1 + Math.floor(rng() * 12);
    const base = 400000 + years * 180000 + Math.floor(rng() * 200000);
    const recruiter = recruiters[i % recruiters.length]!;
    const ageDays = Math.floor(rng() * 150) + 1;

    records.push({
      fullName,
      firstName: first,
      lastName: last,
      email,
      phone,
      source: src.enum as CandidateSource,
      sourceLabel: src.label,
      sourceTag: src.tag,
      location: pick(rng, LOCATIONS),
      currentCompany: pick(rng, COMPANIES),
      currentTitle: jobHint?.title?.replace(/Senior |Staff |Associate /g, "") ?? "Engineer",
      years,
      currentCtc: base,
      expectedCtc: Math.round(base * (1.15 + rng() * 0.25)),
      notice: pick(rng, [0, 15, 30, 60, 90]),
      recruiterUserId: recruiter.userId,
      createdAt: daysAgo(ageDays, 9 + (i % 8)),
      departmentHint,
      index: i,
    });
  }

  async function seedOne(r: RecordRow): Promise<void> {
    const existing = await prisma.candidate.findFirst({
      where: { email: r.email, deletedAt: null },
      select: { id: true },
    });

    const data = {
      fullName: r.fullName,
      firstName: r.firstName,
      lastName: r.lastName,
      email: r.email,
      phone: r.phone,
      location: r.location,
      currentCompany: r.currentCompany,
      currentTitle: r.currentTitle,
      linkedinUrl: `https://linkedin.com/in/${r.firstName.toLowerCase()}-${r.lastName.toLowerCase()}-${r.index}`,
      source: r.source,
      status: CandidateStatus.active,
      currentCtc: new Prisma.Decimal(r.currentCtc),
      expectedCtc: new Prisma.Decimal(r.expectedCtc),
      currency: "INR",
      noticePeriodDays: r.notice,
      earliestJoinDate: daysAgo(-Math.min(r.notice, 45), 10),
      timezone: "Asia/Kolkata",
      primaryRecruiterUserId: r.recruiterUserId,
      createdByUserId: r.recruiterUserId,
      createdAt: r.createdAt,
      normalizedEmail: r.email,
      normalizedPhone: normalizePhone(r.phone),
      deletedAt: null,
      archivedAt: null,
    };

    const candidate = existing
      ? await prisma.candidate.update({ where: { id: existing.id }, data })
      : await prisma.candidate.create({ data });

    await prisma.candidatePersonal.upsert({
      where: { candidateId: candidate.id },
      create: {
        candidateId: candidate.id,
        nationality: "Indian",
        currentLocation: r.location,
        preferredLocation: pick(rng, LOCATIONS),
        noticePeriod: `${r.notice} days`,
        availabilityDate: daysAgo(-Math.min(r.notice, 45), 10),
        linkedinUrl: data.linkedinUrl,
        portfolioUrl:
          r.departmentHint === "Design"
            ? `https://behance.net/demo-${r.index}`
            : `https://github.com/demo-${r.firstName.toLowerCase()}${r.index}`,
      },
      update: {
        currentLocation: r.location,
        preferredLocation: pick(rng, LOCATIONS),
        noticePeriod: `${r.notice} days`,
      },
    });

    await prisma.candidateExperience.deleteMany({ where: { candidateId: candidate.id } });
    await prisma.candidateExperience.create({
      data: {
        candidateId: candidate.id,
        company: r.currentCompany,
        title: r.currentTitle,
        location: r.location,
        startDate: daysAgo(365 * Math.min(r.years, 4)),
        isCurrent: true,
        description: `Working as ${r.currentTitle} at ${r.currentCompany}.`,
        sortOrder: 0,
        companyName: r.currentCompany,
        designation: r.currentTitle,
        currentlyWorking: true,
      },
    });
    if (r.years > 3) {
      await prisma.candidateExperience.create({
        data: {
          candidateId: candidate.id,
          company: pick(rng, COMPANIES),
          title: "Associate",
          location: pick(rng, LOCATIONS),
          startDate: daysAgo(365 * r.years),
          endDate: daysAgo(365 * Math.min(r.years, 4) + 30),
          isCurrent: false,
          description: "Earlier role contributing to delivery and mentoring.",
          sortOrder: 1,
          currentlyWorking: false,
        },
      });
    }

    await prisma.candidateEducation.deleteMany({ where: { candidateId: candidate.id } });
    await prisma.candidateEducation.create({
      data: {
        candidateId: candidate.id,
        institution: pick(rng, [
          "IIT Hyderabad",
          "NIT Warangal",
          "BITS Pilani",
          "IIIT Bangalore",
          "Osmania University",
          "Anna University",
          "VIT Vellore",
        ]),
        degree: pick(rng, ["B.Tech", "M.Tech", "B.E.", "MCA", "MBA"]),
        field: pick(rng, ["Computer Science", "Information Technology", "Electronics", "Business"]),
        fieldOfStudy: "Computer Science",
        startYear: 2012 + (r.index % 8),
        endYear: 2016 + (r.index % 8),
        grade: pick(rng, ["8.2 CGPA", "8.7 CGPA", "First Class", "9.1 CGPA"]),
        sortOrder: 0,
      },
    });

    const skillPool = SKILLS_BY_DEPT[r.departmentHint] ?? SKILLS_BY_DEPT.Engineering!;
    const skills = pickN(rng, skillPool, 3 + Math.floor(rng() * 3));
    await prisma.candidateSkill.deleteMany({ where: { candidateId: candidate.id } });
    await prisma.candidateSkill.createMany({
      data: skills.map((name, idx) => ({
        candidateId: candidate.id,
        name,
        skillName: name,
        proficiency: pick(rng, ["beginner", "intermediate", "advanced", "expert"]),
        yearsOfExperience: Math.max(1, r.years - idx),
        isConfirmed: true,
      })),
      skipDuplicates: true,
    });

    await prisma.candidateProject.deleteMany({ where: { candidateId: candidate.id } });
    await prisma.candidateProject.create({
      data: {
        candidateId: candidate.id,
        title: `${r.currentTitle} showcase project`,
        summary: `Demo project highlighting ${skills.slice(0, 2).join(" & ")}.`,
        description: "End-to-end delivery with measurable impact on latency and reliability.",
        techStack: skills.join(", "),
        technologies: skills.join(", "),
        role: r.currentTitle,
        duration: "8 months",
        url: `https://github.com/demo-zebl/project-${r.index}`,
        sortOrder: 0,
      },
    });

    await prisma.candidateCertification.deleteMany({ where: { candidateId: candidate.id } });
    if (rng() > 0.45) {
      await prisma.candidateCertification.create({
        data: {
          candidateId: candidate.id,
          name: pick(rng, [
            "AWS Solutions Architect Associate",
            "Google Professional Data Engineer",
            "CKA",
            "PMP",
            "ISTQB Foundation",
            "Scrum Master",
          ]),
          issuer: pick(rng, ["AWS", "Google", "CNCF", "PMI", "ISTQB", "Scrum Alliance"]),
          issuedAt: daysAgo(200 + (r.index % 100)),
          issueDate: daysAgo(200 + (r.index % 100)),
          credentialId: `DEMO-CERT-${r.index + 1}`,
        },
      });
    }

    await prisma.candidateTag.deleteMany({ where: { candidateId: candidate.id } });
    await prisma.candidateTag.createMany({
      data: [
        { candidateId: candidate.id, tagId: demoTagId },
        { candidateId: candidate.id, tagId: tagIds[r.sourceTag]! },
      ],
      skipDuplicates: true,
    });

    await prisma.candidateNote.deleteMany({
      where: { candidateId: candidate.id, body: { startsWith: "[Demo]" } },
    });
    await prisma.candidateNote.create({
      data: {
        candidateId: candidate.id,
        body: `[Demo] Sourced via ${r.sourceLabel}. Strong ${r.departmentHint} background (${r.years}y).`,
        authorUserId: r.recruiterUserId,
        isPinned: r.index % 17 === 0,
        createdAt: r.createdAt,
      },
    });

    if (r.index % 11 === 0) {
      await prisma.candidateChatMessage.create({
        data: {
          candidateId: candidate.id,
          body: `[Demo] Quick sync: candidate prefers ${r.location} and ${r.notice}-day notice.`,
          authorUserId: r.recruiterUserId,
          createdAt: daysAgo(
            Math.max(1, Math.floor((Date.now() - r.createdAt.getTime()) / 86400000) - 2)
          ),
        },
      });
    }

    if (r.index % 23 === 0) {
      await prisma.talentPoolEntry.create({
        data: {
          candidateId: candidate.id,
          reason: "Strong profile — keep warm for future openings",
          createdByUserId: r.recruiterUserId,
          enteredAt: daysAgo(20),
        },
      });
    }

    candidates.push({
      id: candidate.id,
      email: r.email,
      fullName: r.fullName,
      phone: r.phone,
      sourceLabel: r.sourceLabel,
      primaryRecruiterUserId: r.recruiterUserId,
      index: r.index,
    });
  }

  let done = 0;
  for (const batch of chunk(records, 10)) {
    for (const r of batch) {
      await seedOne(r);
      done += 1;
    }
    if (done % 50 === 0) logStep(`  candidates progress ${done}/${records.length}`);
  }

  ctx.candidates = candidates;
  ctx.counts.candidates = candidates.length;
  logStep(`Candidates ready (${candidates.length}). Tag=${DEMO_TAG}`);
}
