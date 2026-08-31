import { PrismaClient, OfferStatus, HiringDecisionOutcome } from "../src/generated/prisma/client";

const prisma = new PrismaClient();

export async function seedOffersData(client: PrismaClient = prisma) {
  console.log("Seeding realistic Zebl Tech Healthcare RCM offers...");

  // 1. Get or create a recruiter / admin user for createdByUserId / decidedByUserId
  let recruiterUser = await client.user.findFirst({
    where: { role: { in: ["hr", "super_admin"] } },
  });
  if (!recruiterUser) {
    recruiterUser = await client.user.findFirst();
  }
  const userId = recruiterUser?.id ?? "cl_system_admin_seed";

  // --- OFFER 1 (Draft State): Medical Coding Trainee ---
  let cand1 = await client.candidate.findFirst({
    where: { email: "trainee.coding@zebl.com" },
  });
  if (!cand1) {
    cand1 = await client.candidate.create({
      data: {
        fullName: "Rahul Sharma",
        firstName: "Rahul",
        lastName: "Sharma",
        email: "trainee.coding@zebl.com",
        phone: "+91 9876543210",
        location: "Hyderabad",
        currentTitle: "Medical Coding Trainee",
      },
    });
  }

  let job1 = await client.jobOpening.findFirst({
    where: { title: "Medical Coding Associate" },
  });
  if (!job1) {
    job1 = await client.jobOpening.create({
      data: {
        title: "Medical Coding Associate",
        department: "Medical Coding",
        location: "Hyderabad",
        status: "open",
        createdById: userId,
      },
    });
  }

  let app1 = await client.application.findFirst({
    where: { candidateId: cand1.id, jobOpeningId: job1.id },
  });
  if (!app1) {
    app1 = await client.application.create({
      data: {
        candidateId: cand1.id,
        jobOpeningId: job1.id,
        currentStage: "offer",
      },
    });
  }

  let decision1 = await client.hiringDecision.findFirst({
    where: { applicationId: app1.id },
  });
  if (!decision1) {
    decision1 = await client.hiringDecision.create({
      data: {
        applicationId: app1.id,
        outcome: HiringDecisionOutcome.hire,
        rationale: "Passed medical coding assessment with 92% accuracy.",
        strengths: "CPC Certified, strong knowledge of ICD-10 and CPT coding.",
        version: 1,
        isCurrent: true,
        decidedByUserId: userId,
      },
    });
  }

  const offer1 = await client.offer.upsert({
    where: { offerNumber: "OFFER-2026-1001" },
    update: {
      status: OfferStatus.draft,
      baseSalary: 400000,
      variablePay: 50000,
      ctc: 450000,
      department: "Medical Coding",
      location: "Hyderabad",
      grade: "L1",
      employmentType: "Full-time",
      currency: "INR",
    },
    create: {
      offerNumber: "OFFER-2026-1001",
      applicationId: app1.id,
      hiringDecisionId: decision1.id,
      status: OfferStatus.draft,
      baseSalary: 400000,
      variablePay: 50000,
      ctc: 450000,
      department: "Medical Coding",
      location: "Hyderabad",
      grade: "L1",
      employmentType: "Full-time",
      currency: "INR",
      createdByUserId: userId,
    },
  });

  // --- OFFER 2 (Released State): Senior Medical Billing Specialist ---
  let cand2 = await client.candidate.findFirst({
    where: { email: "sr.billing@zebl.com" },
  });
  if (!cand2) {
    cand2 = await client.candidate.create({
      data: {
        fullName: "Ananya Reddy",
        firstName: "Ananya",
        lastName: "Reddy",
        email: "sr.billing@zebl.com",
        phone: "+91 9876543211",
        location: "Hyderabad",
        currentTitle: "Senior Medical Billing Specialist",
      },
    });
  }

  let job2 = await client.jobOpening.findFirst({
    where: { title: "Senior Medical Billing Specialist" },
  });
  if (!job2) {
    job2 = await client.jobOpening.create({
      data: {
        title: "Senior Medical Billing Specialist",
        department: "Billing & Collections",
        location: "Hyderabad",
        status: "open",
        createdById: userId,
      },
    });
  }

  let app2 = await client.application.findFirst({
    where: { candidateId: cand2.id, jobOpeningId: job2.id },
  });
  if (!app2) {
    app2 = await client.application.create({
      data: {
        candidateId: cand2.id,
        jobOpeningId: job2.id,
        currentStage: "offer",
      },
    });
  }

  let decision2 = await client.hiringDecision.findFirst({
    where: { applicationId: app2.id },
  });
  if (!decision2) {
    decision2 = await client.hiringDecision.create({
      data: {
        applicationId: app2.id,
        outcome: HiringDecisionOutcome.strong_hire,
        rationale: "Extensive experience in US Healthcare RCM billing & denial management.",
        strengths: "Advanced EHR proficiency, claims denial reduction expertise.",
        version: 1,
        isCurrent: true,
        decidedByUserId: userId,
      },
    });
  }

  const offer2 = await client.offer.upsert({
    where: { offerNumber: "OFFER-2026-1002" },
    update: {
      status: OfferStatus.released,
      baseSalary: 800000,
      bonus: 100000,
      ctc: 900000,
      department: "Billing & Collections",
      location: "Hyderabad",
      grade: "L2",
      employmentType: "Full-time",
      currency: "INR",
      offerPdfKey: "offers/mock-billing-spec.pdf",
      releasedAt: new Date(),
      sentAt: new Date(),
    },
    create: {
      offerNumber: "OFFER-2026-1002",
      applicationId: app2.id,
      hiringDecisionId: decision2.id,
      status: OfferStatus.released,
      baseSalary: 800000,
      bonus: 100000,
      ctc: 900000,
      department: "Billing & Collections",
      location: "Hyderabad",
      grade: "L2",
      employmentType: "Full-time",
      currency: "INR",
      offerPdfKey: "offers/mock-billing-spec.pdf",
      releasedAt: new Date(),
      sentAt: new Date(),
      createdByUserId: userId,
    },
  });

  // --- OFFER 3 (Accepted State): Operations Manager ---
  let cand3 = await client.candidate.findFirst({
    where: { email: "ops.mgr@zebl.com" },
  });
  if (!cand3) {
    cand3 = await client.candidate.create({
      data: {
        fullName: "Srinivas Rao",
        firstName: "Srinivas",
        lastName: "Rao",
        email: "ops.mgr@zebl.com",
        phone: "+91 9876543212",
        location: "Hyderabad",
        currentTitle: "RCM Operations Manager",
      },
    });
  }

  let job3 = await client.jobOpening.findFirst({
    where: { title: "Client Operations Manager" },
  });
  if (!job3) {
    job3 = await client.jobOpening.create({
      data: {
        title: "Client Operations Manager",
        department: "Client Operations",
        location: "Hyderabad",
        status: "open",
        createdById: userId,
      },
    });
  }

  let app3 = await client.application.findFirst({
    where: { candidateId: cand3.id, jobOpeningId: job3.id },
  });
  if (!app3) {
    app3 = await client.application.create({
      data: {
        candidateId: cand3.id,
        jobOpeningId: job3.id,
        currentStage: "offer",
      },
    });
  }

  let decision3 = await client.hiringDecision.findFirst({
    where: { applicationId: app3.id },
  });
  if (!decision3) {
    decision3 = await client.hiringDecision.create({
      data: {
        applicationId: app3.id,
        outcome: HiringDecisionOutcome.strong_hire,
        rationale: "10+ years leading multi-client Healthcare RCM operations.",
        strengths: "SLA management, team leadership, client relationship management.",
        version: 1,
        isCurrent: true,
        decidedByUserId: userId,
      },
    });
  }

  const offer3 = await client.offer.upsert({
    where: { offerNumber: "OFFER-2026-1003" },
    update: {
      status: OfferStatus.accepted,
      baseSalary: 1600000,
      variablePay: 200000,
      ctc: 1800000,
      department: "Client Operations",
      location: "Hyderabad",
      grade: "L4",
      employmentType: "Full-time",
      currency: "INR",
      releasedAt: new Date(),
      sentAt: new Date(),
      acceptedAt: new Date(),
    },
    create: {
      offerNumber: "OFFER-2026-1003",
      applicationId: app3.id,
      hiringDecisionId: decision3.id,
      status: OfferStatus.accepted,
      baseSalary: 1600000,
      variablePay: 200000,
      ctc: 1800000,
      department: "Client Operations",
      location: "Hyderabad",
      grade: "L4",
      employmentType: "Full-time",
      currency: "INR",
      releasedAt: new Date(),
      sentAt: new Date(),
      acceptedAt: new Date(),
      createdByUserId: userId,
    },
  });

  console.log("Successfully seeded 3 Zebl Tech Healthcare RCM offers:");
  console.log(`- Draft Offer: ${offer1.offerNumber} (${cand1.fullName})`);
  console.log(`- Released Offer: ${offer2.offerNumber} (${cand2.fullName})`);
  console.log(`- Accepted Offer: ${offer3.offerNumber} (${cand3.fullName})`);
}

seedOffersData()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
