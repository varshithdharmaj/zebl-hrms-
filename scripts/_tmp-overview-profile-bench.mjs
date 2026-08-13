import { register } from "node:module";
import { pathToFileURL } from "node:url";
register("./scripts/mock-server-only-register.mjs", pathToFileURL("./"));

const { prisma } = await import("../src/lib/prisma.ts");
const { AiInsightType } = await import("../src/generated/prisma/enums.ts");

async function bench(label, fn) {
  const start = performance.now();
  const result = await fn();
  const ms = Math.round(performance.now() - start);
  let extra = "";
  if (Array.isArray(result)) extra = ` rows=${result.length}`;
  else if (result && typeof result === "object") {
    const counts = Object.entries(result)
      .filter(([, v]) => typeof v === "number" || Array.isArray(v))
      .map(([k, v]) => `${k}=${Array.isArray(v) ? v.length : v}`)
      .join(",");
    if (counts) extra = ` ${counts}`;
  }
  console.log(`${label}: ${ms}ms${extra}`);
  return { ms, result };
}

const candidate = await prisma.candidate.findFirst({
  where: { deletedAt: null },
  select: { id: true, fullName: true },
  orderBy: { updatedAt: "desc" },
});
if (!candidate) {
  console.error("No candidate");
  process.exit(1);
}

const id = candidate.id;
console.log(`Profiling candidate ${id} (${candidate.fullName})`);
console.log("---");

await bench("1 scalars only", () =>
  prisma.candidate.findFirst({ where: { id }, select: { id: true, fullName: true, headline: true } })
);

const personal = await bench("2 + personal", () =>
  prisma.candidate.findFirst({ where: { id }, include: { personal: true } })
);

await bench("3 + experiences", () =>
  prisma.candidate.findFirst({
    where: { id },
    include: { personal: true, experiences: { orderBy: { sortOrder: "asc" } } },
  })
);

await bench("4 + educations", () =>
  prisma.candidate.findFirst({
    where: { id },
    include: {
      personal: true,
      experiences: { orderBy: { sortOrder: "asc" } },
      educations: { orderBy: { sortOrder: "asc" } },
    },
  })
);

await bench("5 + skills", () =>
  prisma.candidate.findFirst({
    where: { id },
    include: {
      personal: true,
      experiences: { orderBy: { sortOrder: "asc" } },
      educations: { orderBy: { sortOrder: "asc" } },
      skills: true,
    },
  })
);

await bench("6 + projects", () =>
  prisma.candidate.findFirst({
    where: { id },
    include: {
      personal: true,
      experiences: { orderBy: { sortOrder: "asc" } },
      educations: { orderBy: { sortOrder: "asc" } },
      skills: true,
      projects: { orderBy: { sortOrder: "asc" } },
    },
  })
);

await bench("7 + certifications", () =>
  prisma.candidate.findFirst({
    where: { id },
    include: {
      personal: true,
      experiences: { orderBy: { sortOrder: "asc" } },
      educations: { orderBy: { sortOrder: "asc" } },
      skills: true,
      projects: { orderBy: { sortOrder: "asc" } },
      certifications: true,
    },
  })
);

await bench("8 + notes (take 50)", () =>
  prisma.candidate.findFirst({
    where: { id },
    include: {
      personal: true,
      experiences: { orderBy: { sortOrder: "asc" } },
      educations: { orderBy: { sortOrder: "asc" } },
      skills: true,
      projects: { orderBy: { sortOrder: "asc" } },
      certifications: true,
      notes: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          author: {
            select: {
              email: true,
              role: true,
              profilePhotoUrl: true,
              employee: { select: { name: true } },
            },
          },
        },
      },
    },
  })
);

await bench("9 + primaryRecruiter", () =>
  prisma.candidate.findFirst({
    where: { id },
    include: {
      personal: true,
      experiences: { orderBy: { sortOrder: "asc" } },
      educations: { orderBy: { sortOrder: "asc" } },
      skills: true,
      projects: { orderBy: { sortOrder: "asc" } },
      certifications: true,
      notes: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          author: {
            select: {
              email: true,
              role: true,
              profilePhotoUrl: true,
              employee: { select: { name: true } },
            },
          },
        },
      },
      primaryRecruiter: { select: { employee: { select: { name: true } } } },
    },
  })
);

await bench("10 + document count", () =>
  prisma.candidate.findFirst({
    where: { id },
    include: {
      personal: true,
      experiences: { orderBy: { sortOrder: "asc" } },
      educations: { orderBy: { sortOrder: "asc" } },
      skills: true,
      projects: { orderBy: { sortOrder: "asc" } },
      certifications: true,
      notes: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          author: {
            select: {
              email: true,
              role: true,
              profilePhotoUrl: true,
              employee: { select: { name: true } },
            },
          },
        },
      },
      primaryRecruiter: { select: { employee: { select: { name: true } } } },
      _count: { select: { documents: { where: { deletedAt: null } } } },
    },
  })
);

const { getCandidateOverviewCached } = await import("../src/lib/recruitment/candidate/queries.ts");
const user = await prisma.user.findFirst({
  where: { role: { in: ["hr", "super_admin"] } },
  select: { id: true, email: true, role: true, employeeId: true },
});
const session = {
  id: user.id,
  email: user.email,
  role: user.role,
  employeeId: user.employeeId,
  employeeName: "Bench",
  sessionVersion: 1,
  authProvider: "local",
};

const overview = await bench("FULL getCandidateOverviewCached", () =>
  getCandidateOverviewCached(session, id)
);

if (overview.result) {
  const payload = JSON.stringify(overview.result);
  console.log(`Overview payload JSON size: ${payload.length} bytes`);
  console.log(
    `Row counts: exp=${overview.result.experiences.length} edu=${overview.result.educations.length} skills=${overview.result.skills.length} projects=${overview.result.projects.length} certs=${overview.result.certifications.length} notes=${overview.result.notes.length} docs=${overview.result.documentCount ?? 0}`
  );
}

await prisma.$disconnect();
