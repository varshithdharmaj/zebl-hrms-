/**
 * Shared mutable context passed between modular demo seeders.
 */
import type { PrismaClient } from "@/generated/prisma/client";
import type { DemoUserKey } from "./constants";

export type DemoActor = {
  userId: string;
  employeeId: number;
  email: string;
  name: string;
  role: string;
};

export type DemoJobRef = {
  id: string;
  code: string;
  title: string;
  department: string;
  location: string;
  employmentType: string;
  status: string;
  ownerUserId: string;
  hmEmployeeId: number;
  compensationMin: number;
  compensationMax: number;
};

export type DemoCandidateRef = {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  sourceLabel: string;
  primaryRecruiterUserId: string;
  index: number;
};

export type DemoApplicationRef = {
  id: string;
  candidateId: string;
  jobOpeningId: string;
  currentStage: string;
  status: string;
  assignedRecruiterUserId: string;
  createdAt: Date;
  stageEnteredAt: Date;
};

export type DemoInterviewRef = {
  id: string;
  applicationId: string;
  status: string;
  roundType: string;
};

export type DemoOfferRef = {
  id: string;
  applicationId: string;
  candidateId: string;
  jobOpeningId: string;
  status: string;
  baseSalary: number;
  department: string;
  location: string;
  employmentType: string;
  joiningDate: Date;
  accepted: boolean;
};

export type DemoTemplateRef = {
  key: string;
  id: string;
  type: string;
};

export type DemoSeedContext = {
  prisma: PrismaClient;
  rng: () => number;
  actors: Record<DemoUserKey, DemoActor>;
  actorList: DemoActor[];
  recruiters: DemoActor[];
  pipelineTemplateId: string;
  pipelineStages: Array<{
    stage: string;
    sortOrder: number;
    isOptional: boolean;
    label: string | null;
    slaDays: number | null;
  }>;
  jobs: DemoJobRef[];
  candidates: DemoCandidateRef[];
  applications: DemoApplicationRef[];
  interviews: DemoInterviewRef[];
  offers: DemoOfferRef[];
  templates: DemoTemplateRef[];
  tagIds: Record<string, string>;
  demoTagId: string;
  counts: Record<string, number>;
};
