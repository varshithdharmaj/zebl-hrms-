import { register } from "node:module";
import { pathToFileURL } from "node:url";
register("./scripts/mock-server-only-register.mjs", pathToFileURL("./"));

const { prisma } = await import("../src/lib/prisma.ts");
const { RecruitmentScopeEngine } = await import(
  "../src/lib/recruitment/permissions/recruitment-scope-engine.ts"
);
const { toRecruitmentActor } = await import(
  "../src/lib/recruitment/permissions/permission-service.ts"
);
const { getCandidateOverviewCached } = await import("../src/lib/recruitment/candidate/queries.ts");
const { listApplicationsCached, countCandidateApplicationsCached } = await import(
  "../src/lib/recruitment/application/queries.ts"
);
const { listInterviewsCached } = await import("../src/lib/recruitment/interview/queries.ts");
const { listOffersCached } = await import("../src/lib/recruitment/offer/queries.ts");
const { listCandidateDocumentsCached, getCandidateTimelineCached } = await import(
  "../src/lib/recruitment/candidate/queries.ts"
);

function toSession(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    employeeId: user.employeeId,
    employeeName: user.email,
    sessionVersion: 1,
    authProvider: "local",
    recruitmentOpsAccess: user.recruitmentOpsAccess === true,
  };
}

const unrestrictedUser = await prisma.user.findFirst({
  where: { role: { in: ["hr", "super_admin"] } },
  select: {
    id: true,
    email: true,
    role: true,
    employeeId: true,
    recruitmentOpsAccess: true,
  },
});

const restrictedUser = await prisma.user.findFirst({
  where: {
    role: { notIn: ["hr", "super_admin"] },
    recruitmentOpsAccess: false,
    employeeId: { not: null },
    employee: {
      OR: [
        { hiringTeamMemberships: { some: {} } },
        { interviewPanelistOf: { some: {} } },
        { applicationsAsManager: { some: { deletedAt: null } } },
      ],
    },
  },
  select: {
    id: true,
    email: true,
    role: true,
    employeeId: true,
    recruitmentOpsAccess: true,
  },
});

const inScopeCandidate = await prisma.candidate.findFirst({
  where: { deletedAt: null },
  select: { id: true },
  orderBy: { updatedAt: "desc" },
});

console.log("=== Restricted recruiter authorization verification ===");
console.log(`HR user: ${unrestrictedUser?.email ?? "NONE"}`);
console.log(`Restricted user: ${restrictedUser?.email ?? "NONE"}`);
console.log(`In-scope candidate (HR): ${inScopeCandidate?.id ?? "NONE"}`);

if (!unrestrictedUser || !inScopeCandidate) {
  console.error("Missing HR user or candidate — cannot verify");
  process.exit(1);
}

const hrSession = toSession(unrestrictedUser);
const restrictedSession = restrictedUser ? toSession(restrictedUser) : null;

async function expectDenied(label, fn) {
  try {
    await fn();
    console.log(`FAIL ${label}: expected denial but succeeded`);
    return false;
  } catch (error) {
    const { PermissionError } = await import("../src/lib/permissions.ts");
    if (error instanceof PermissionError) {
      console.log(`PASS ${label}: PermissionError`);
      return true;
    }
    console.log(`FAIL ${label}: unexpected error ${error instanceof Error ? error.message : error}`);
    return false;
  }
}

async function runScopedChecks(session, label, candidateId) {
  console.log(`--- ${label} candidate=${candidateId} ---`);
  try {
    await getCandidateOverviewCached(session, candidateId);
    console.log(`PASS overview accessible`);
  } catch (error) {
    console.log(
      `INFO overview denied: ${error instanceof Error ? error.message : String(error)}`
    );
    return;
  }

  const apps = await listApplicationsCached(
    session,
    { candidateId },
    { page: 1, pageSize: 50 },
    { field: "createdAt", direction: "desc" }
  );
  console.log(`INFO applications returned: ${apps.items.length}`);

  const appIds = new Set(apps.items.map((a) => a.id));

  const interviews = await listInterviewsCached(
    session,
    { candidateId },
    { page: 1, pageSize: 50 }
  );
  console.log(`INFO interviews returned: ${interviews.items.length}`);

  const offers = await listOffersCached(
    session,
    { candidateId },
    { page: 1, pageSize: 50 },
    { field: "createdAt", direction: "desc" }
  );
  console.log(`INFO offers returned: ${offers.items.length}`);

  const offerAppIds = offers.items.map((o) => o.applicationId);
  const offersSubset = offerAppIds.every((aid) => appIds.has(aid));
  console.log(
    offersSubset
      ? "PASS offers ⊆ scoped applications"
      : `WARN offers not subset of applications (apps=${appIds.size}, offerApps=${new Set(offerAppIds).size})`
  );

  const docs = await listCandidateDocumentsCached(session, candidateId);
  console.log(`INFO documents returned: ${docs.length}`);

  const timeline = await getCandidateTimelineCached(session, candidateId, 50);
  console.log(`INFO timeline returned: ${timeline.length}`);
}

await runScopedChecks(hrSession, "HR", inScopeCandidate.id);

if (restrictedSession) {
  const scope = await RecruitmentScopeEngine.resolveScope(toRecruitmentActor(restrictedSession));
  console.log(
    `Restricted scope: mode=${scope.mode} jobs=${scope.jobOpeningIds.length} apps=${scope.applicationIds.length} candidates=${scope.candidateIds.length}`
  );

  if (scope.candidateIds.length > 0) {
    await runScopedChecks(restrictedSession, "Restricted (in-scope)", scope.candidateIds[0]);
  } else {
    console.log("SKIP restricted in-scope checks: assigned scope has no candidate ids");
  }

  const outOfScopeId = await prisma.candidate.findFirst({
    where: {
      deletedAt: null,
      id: scope.candidateIds.length > 0 ? { notIn: scope.candidateIds } : undefined,
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  if (outOfScopeId) {
    await expectDenied("Out-of-scope candidate overview", () =>
      getCandidateOverviewCached(restrictedSession, outOfScopeId.id)
    );
    await expectDenied("Out-of-scope candidate documents", () =>
      listCandidateDocumentsCached(restrictedSession, outOfScopeId.id)
    );
    await expectDenied("Out-of-scope candidate timeline", () =>
      getCandidateTimelineCached(restrictedSession, outOfScopeId.id, 50)
    );
  } else {
    console.log("SKIP out-of-scope candidate: no candidate outside assigned scope");
  }
} else {
  console.log("SKIP restricted user checks: no restricted recruiter account in DB");
}

await prisma.$disconnect();
