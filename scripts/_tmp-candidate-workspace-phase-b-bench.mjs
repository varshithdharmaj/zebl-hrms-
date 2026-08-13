import { register } from "node:module";
import { pathToFileURL } from "node:url";
register("./scripts/mock-server-only-register.mjs", pathToFileURL("./"));

const { prisma } = await import("../src/lib/prisma.ts");

async function bench(label, fn) {
  const start = performance.now();
  const result = await fn();
  const ms = Math.round(performance.now() - start);
  let extra = "";
  if (result?.items) extra = ` items=${result.items.length}`;
  else if (Array.isArray(result)) extra = ` rows=${result.length}`;
  console.log(`${label}: ${ms}ms${extra}`);
  return { ms, result };
}

const user = await prisma.user.findFirst({
  where: { role: { in: ["hr", "super_admin"] } },
  select: { id: true, email: true, role: true, employeeId: true },
});
if (!user) {
  console.error("No HR user found");
  process.exit(1);
}

const session = {
  id: user.id,
  email: user.email,
  role: user.role,
  employeeId: user.employeeId,
  employeeName: "Bench User",
  sessionVersion: 1,
  authProvider: "local",
};

const candidate = await prisma.candidate.findFirst({
  where: { deletedAt: null },
  select: { id: true, fullName: true },
  orderBy: { updatedAt: "desc" },
});
if (!candidate) {
  console.error("No candidate found");
  process.exit(1);
}

console.log(`Candidate: ${candidate.id} (${candidate.fullName})`);
console.log(`Session: ${session.email} (${session.role})`);
console.log("---");

const {
  getCandidateCached,
  getCandidateOverviewCached,
  listCandidateDocumentsCached,
  getCandidateTimelineCached,
  listResumeParseDraftsCached,
} = await import("../src/lib/recruitment/candidate/queries.ts");
const { listApplicationsCached, countCandidateApplicationsCached } = await import(
  "../src/lib/recruitment/application/queries.ts"
);
const { listInterviewsCached } = await import("../src/lib/recruitment/interview/queries.ts");
const { listOffersCached } = await import("../src/lib/recruitment/offer/queries.ts");
const { createCandidateAiEnrichmentService } = await import(
  "../src/lib/recruitment/services/candidate-ai-enrichment-service.ts"
);
const { createCandidateAiRecoveryService } = await import(
  "../src/lib/recruitment/services/candidate-ai-recovery-service.ts"
);
const { RecruitmentPermissionService } = await import(
  "../src/lib/recruitment/permissions/permission-service.ts"
);

const candidateId = candidate.id;
const enrichmentService = createCandidateAiEnrichmentService();
const recoveryService = createCandidateAiRecoveryService();

async function loadOverviewTab() {
  const t0 = performance.now();
  await getCandidateOverviewCached(session, candidateId);
  const overviewMs = Math.round(performance.now() - t0);

  const t1 = performance.now();
  await listApplicationsCached(
    session,
    { candidateId },
    { page: 1, pageSize: 50 },
    { field: "createdAt", direction: "desc" }
  );
  const appsMs = Math.round(performance.now() - t1);

  const t2 = performance.now();
  await Promise.all([
    RecruitmentPermissionService.canWriteCandidateDiscussion(session, candidateId),
    enrichmentService.listLatestEnrichment(candidateId),
    recoveryService.listLatestRecovery(candidateId),
    listResumeParseDraftsCached(session, candidateId, 5),
  ]);
  const overviewExtrasMs = Math.round(performance.now() - t2);

  const total = overviewMs + appsMs + overviewExtrasMs;
  console.log(`TAB overview (sequential sum): ${total}ms`);
  console.log(`  getCandidateOverviewCached: ${overviewMs}ms`);
  console.log(`  listApplicationsCached: ${appsMs}ms`);
  console.log(`  overview Promise.all: ${overviewExtrasMs}ms`);
  return total;
}

async function loadApplicationsTab() {
  const t0 = performance.now();
  await getCandidateOverviewCached(session, candidateId);
  const overviewMs = Math.round(performance.now() - t0);

  const t1 = performance.now();
  await listApplicationsCached(
    session,
    { candidateId },
    { page: 1, pageSize: 50 },
    { field: "createdAt", direction: "desc" }
  );
  const appsMs = Math.round(performance.now() - t1);

  const t2 = performance.now();
  await Promise.all([
    listInterviewsCached(session, { candidateId }, { page: 1, pageSize: 50 }),
    listOffersCached(
      session,
      { candidateId },
      { page: 1, pageSize: 50 },
      { field: "createdAt", direction: "desc" }
    ),
  ]);
  const tabMs = Math.round(performance.now() - t2);

  const total = overviewMs + appsMs + tabMs;
  console.log(`TAB applications (sequential sum): ${total}ms`);
  console.log(`  getCandidateOverviewCached: ${overviewMs}ms`);
  console.log(`  listApplicationsCached: ${appsMs}ms`);
  console.log(`  interviews+offers Promise.all: ${tabMs}ms`);
  return total;
}

async function loadDocumentsTab() {
  const t0 = performance.now();
  await getCandidateOverviewCached(session, candidateId);
  const overviewMs = Math.round(performance.now() - t0);

  const t1 = performance.now();
  await countCandidateApplicationsCached(session, candidateId);
  const appsMs = Math.round(performance.now() - t1);

  const t2 = performance.now();
  await listCandidateDocumentsCached(session, candidateId);
  const docsMs = Math.round(performance.now() - t2);

  const total = overviewMs + appsMs + docsMs;
  console.log(`TAB documents (sequential sum): ${total}ms`);
  console.log(`  getCandidateOverviewCached: ${overviewMs}ms`);
  console.log(`  countCandidateApplicationsCached: ${appsMs}ms`);
  console.log(`  listCandidateDocumentsCached: ${docsMs}ms`);
  return total;
}

async function loadActivityTab() {
  const t0 = performance.now();
  await getCandidateOverviewCached(session, candidateId);
  const overviewMs = Math.round(performance.now() - t0);

  const t1 = performance.now();
  await countCandidateApplicationsCached(session, candidateId);
  const appsMs = Math.round(performance.now() - t1);

  const t2 = performance.now();
  await getCandidateTimelineCached(session, candidateId, 50);
  const timelineMs = Math.round(performance.now() - t2);

  const total = overviewMs + appsMs + timelineMs;
  console.log(`TAB activity (sequential sum): ${total}ms`);
  console.log(`  getCandidateOverviewCached: ${overviewMs}ms`);
  console.log(`  countCandidateApplicationsCached: ${appsMs}ms`);
  console.log(`  getCandidateTimelineCached: ${timelineMs}ms`);
  return total;
}

async function loadLegacyFullCandidate() {
  const t0 = performance.now();
  await getCandidateCached(session, candidateId);
  const fullMs = Math.round(performance.now() - t0);
  console.log(`LEGACY getCandidateCached (full detailInclude): ${fullMs}ms`);
  return fullMs;
}

console.log("=== Phase C workspace benchmark (dev DB, isolated loaders) ===");
await loadLegacyFullCandidate();
console.log("---");
await loadOverviewTab();
console.log("---");
await loadApplicationsTab();
console.log("---");
await loadDocumentsTab();
console.log("---");
await loadActivityTab();

await prisma.$disconnect();
