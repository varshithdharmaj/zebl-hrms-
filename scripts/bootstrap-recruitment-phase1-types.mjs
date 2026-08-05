import fs from "node:fs";
import path from "node:path";

const root = "src/lib/recruitment";

function write(rel, content) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content.replace(/^\n/, ""));
  console.log("W", full);
}

for (const dir of [
  "ai",
  "application",
  "candidate",
  "conversion",
  "dashboard",
  "interview",
  "job",
  "offer",
  "pipeline",
  "reports",
]) {
  write(
    `${dir}/index.ts`,
    `/** Phase 1 placeholder — ${dir} bounded context (no business logic yet). */\nexport {};\n`
  );
}

write(
  "types/action.ts",
  `import type { ActionState as PlatformActionState } from "@/actions/types";

/** Re-export platform ActionState — do not invent a parallel shape. */
export type ActionState = PlatformActionState;

export type ActionResult<T> =
  | { ok: true; data: T; state?: ActionState }
  | { ok: false; state: ActionState };
`
);

write(
  "types/actor.ts",
  `import type { AppUserRole } from "@/lib/roles";

/** Authenticated actor for recruitment permission/scope resolution. */
export type RecruitmentActor = {
  userId: string;
  email: string;
  role: AppUserRole;
  employeeId: number | null;
};
`
);

write(
  "types/scope.ts",
  `/**
 * Visibility scope resolved by RecruitmentScopeEngine.
 * Unrestricted = SA/HR. Otherwise filter by assignment sets.
 */
export type RecruitmentScopeMode = "unrestricted" | "assigned";

export type RecruitmentScope = {
  mode: RecruitmentScopeMode;
  /** Empty when unrestricted (do not apply jobId IN filter). */
  jobOpeningIds: readonly string[];
  applicationIds: readonly string[];
  candidateIds: readonly string[];
  /** Hiring-team / panel roles observed for this actor. */
  capabilities: {
    isRecruiterOnJob: boolean;
    isHiringManager: boolean;
    isTeamLead: boolean;
    isInterviewer: boolean;
  };
};

export function emptyRecruitmentScope(): RecruitmentScope {
  return {
    mode: "assigned",
    jobOpeningIds: [],
    applicationIds: [],
    candidateIds: [],
    capabilities: {
      isRecruiterOnJob: false,
      isHiringManager: false,
      isTeamLead: false,
      isInterviewer: false,
    },
  };
}

export function unrestrictedRecruitmentScope(): RecruitmentScope {
  return {
    mode: "unrestricted",
    jobOpeningIds: [],
    applicationIds: [],
    candidateIds: [],
    capabilities: {
      isRecruiterOnJob: true,
      isHiringManager: true,
      isTeamLead: true,
      isInterviewer: true,
    },
  };
}
`
);

write(
  "types/pagination.ts",
  `export type SortDirection = "asc" | "desc";

export type SortOptions = {
  field: string;
  direction: SortDirection;
};

export type PaginationInput = {
  page: number;
  pageSize: number;
};

export type CursorPaginationInput = {
  cursor: string | null;
  limit: number;
};

export type PageResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type CursorPageResult<T> = {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type SearchFilters = {
  q?: string;
  status?: string;
  [key: string]: string | number | boolean | undefined;
};
`
);

write(
  "types/timeline.ts",
  `import type { RecruitmentTimelineEntityType } from "@/generated/prisma/enums";

export type TimelineItem = {
  id: string;
  entityType: RecruitmentTimelineEntityType;
  entityId: string;
  applicationId: string | null;
  candidateId: string | null;
  jobOpeningId: string | null;
  eventType: string;
  summary: string;
  actorUserId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
};

export type AppendTimelineInput = {
  entityType: RecruitmentTimelineEntityType;
  entityId: string;
  eventType: string;
  summary: string;
  actorUserId?: string | null;
  applicationId?: string | null;
  candidateId?: string | null;
  jobOpeningId?: string | null;
  metadata?: Record<string, unknown>;
};
`
);

write(
  "types/events.ts",
  `import type { RecruitmentActor } from "@/lib/recruitment/types/actor";

export const RECRUITMENT_EVENT_TYPES = [
  "ApplicationCreated",
  "ApplicationStageChanged",
  "InterviewScheduled",
  "InterviewCompleted",
  "HiringDecisionSubmitted",
  "OfferReleased",
  "CandidateMerged",
  "EmployeeConverted",
] as const;

export type RecruitmentEventType = (typeof RECRUITMENT_EVENT_TYPES)[number];

export type RecruitmentEventBase<TType extends RecruitmentEventType, TPayload> = {
  type: TType;
  eventId: string;
  occurredAt: string;
  actor: RecruitmentActor;
  correlationId?: string;
  causationId?: string;
  payload: TPayload;
};

export type ApplicationCreatedPayload = {
  applicationId: string;
  candidateId: string;
  jobOpeningId: string;
};

export type ApplicationStageChangedPayload = {
  applicationId: string;
  candidateId: string;
  jobOpeningId: string;
  fromStage: string | null;
  toStage: string;
  isOverride: boolean;
};

export type InterviewScheduledPayload = {
  interviewId: string;
  applicationId: string;
  scheduledStart: string | null;
  panelistEmployeeIds: number[];
};

export type InterviewCompletedPayload = {
  interviewId: string;
  applicationId: string;
};

export type HiringDecisionSubmittedPayload = {
  decisionId: string;
  applicationId: string;
  outcome: string;
  version: number;
};

export type OfferReleasedPayload = {
  offerId: string;
  applicationId: string;
  candidateId: string;
};

export type CandidateMergedPayload = {
  survivorCandidateId: string;
  loserCandidateId: string;
};

export type EmployeeConvertedPayload = {
  snapshotId: string;
  applicationId: string;
  candidateId: string;
  offerId: string;
  employeeId: number;
};

export type ApplicationCreatedEvent = RecruitmentEventBase<
  "ApplicationCreated",
  ApplicationCreatedPayload
>;
export type ApplicationStageChangedEvent = RecruitmentEventBase<
  "ApplicationStageChanged",
  ApplicationStageChangedPayload
>;
export type InterviewScheduledEvent = RecruitmentEventBase<
  "InterviewScheduled",
  InterviewScheduledPayload
>;
export type InterviewCompletedEvent = RecruitmentEventBase<
  "InterviewCompleted",
  InterviewCompletedPayload
>;
export type HiringDecisionSubmittedEvent = RecruitmentEventBase<
  "HiringDecisionSubmitted",
  HiringDecisionSubmittedPayload
>;
export type OfferReleasedEvent = RecruitmentEventBase<"OfferReleased", OfferReleasedPayload>;
export type CandidateMergedEvent = RecruitmentEventBase<"CandidateMerged", CandidateMergedPayload>;
export type EmployeeConvertedEvent = RecruitmentEventBase<
  "EmployeeConverted",
  EmployeeConvertedPayload
>;

export type RecruitmentDomainEvent =
  | ApplicationCreatedEvent
  | ApplicationStageChangedEvent
  | InterviewScheduledEvent
  | InterviewCompletedEvent
  | HiringDecisionSubmittedEvent
  | OfferReleasedEvent
  | CandidateMergedEvent
  | EmployeeConvertedEvent;
`
);

write(
  "types/index.ts",
  `export type { ActionState, ActionResult } from "@/lib/recruitment/types/action";
export type { RecruitmentActor } from "@/lib/recruitment/types/actor";
export type { RecruitmentScope, RecruitmentScopeMode } from "@/lib/recruitment/types/scope";
export {
  emptyRecruitmentScope,
  unrestrictedRecruitmentScope,
} from "@/lib/recruitment/types/scope";
export type {
  SortDirection,
  SortOptions,
  PaginationInput,
  CursorPaginationInput,
  PageResult,
  CursorPageResult,
  SearchFilters,
} from "@/lib/recruitment/types/pagination";
export type { TimelineItem, AppendTimelineInput } from "@/lib/recruitment/types/timeline";
export type {
  RecruitmentEventType,
  RecruitmentDomainEvent,
  ApplicationCreatedEvent,
  ApplicationStageChangedEvent,
  InterviewScheduledEvent,
  InterviewCompletedEvent,
  HiringDecisionSubmittedEvent,
  OfferReleasedEvent,
  CandidateMergedEvent,
  EmployeeConvertedEvent,
} from "@/lib/recruitment/types/events";
export { RECRUITMENT_EVENT_TYPES } from "@/lib/recruitment/types/events";
`
);

console.log("phase1 bootstrap types ok");
