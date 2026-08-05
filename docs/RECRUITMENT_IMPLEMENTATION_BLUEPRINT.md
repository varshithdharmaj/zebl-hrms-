# ZEBL_HRMS — Recruitment Implementation Blueprint

| Field | Value |
|-------|-------|
| **Document** | Production implementation blueprint (execution plan only) |
| **Status** | Ready for team execution planning |
| **Bound to (LOCKED)** | `docs/RECRUITMENT_PRD.md`, `docs/RECRUITMENT_ARCHITECTURE.md`, `docs/RECRUITMENT_SCHEMA_DESIGN.md` |
| **Out of scope** | Code, Prisma application, migrations, UI markup, API routes, SQL |
| **Audience** | Senior engineers implementing Recruitment inside ZEBL_AMS |

---

## Blueprint axioms

1. Do not contradict locked documents.
2. Fit existing ZEBL patterns: `ActionState`, FormData + Zod, `src/actions/*`, admin shell `/admin/recruitment/*`, `writeAuditLog` / `enqueueNotification` **only via event consumers**.
3. Every read goes through **RecruitmentScopeEngine**. Every major write publishes a **domain event** after commit.
4. System roles remain `super_admin` | `hr` | `employee`. Personas (Recruiter, Hiring Manager, Team Lead, Interviewer) are **capabilities**, not `UserRole` values.
5. Schema work is a **prerequisite gate** before Phase 1 app code, but this blueprint does not author schema/migrations.

### Prerequisite gate (before Phase 1 application code)

| Gate | Owner | Exit criteria |
|------|-------|----------------|
| Apply schema design to `schema.prisma` | Platform | Models/enums match schema design doc |
| Migration + partial unique SQL | Platform | Indexes from schema design §6 exist |
| Extend `NotificationType` | Platform | Recruitment notification values available |
| Seed `RecruitmentSettings` + default pipeline template | Platform | Singleton settings row + system template |
| Feature flag `recruitment_module_enabled` | Platform | Default off in production until Phase 10 soft-launch |

---

# 1. Implementation Phases

Complexity: **S** = 1–3 eng-days · **M** = ~1 week · **L** = 1.5–3 weeks · **XL** = 3+ weeks (team).

---

## Phase 0 — Schema & platform hooks

| | |
|--|--|
| **Goals** | Land database models, enums, partial indexes, NotificationType extensions, User/Employee relation stubs. |
| **Dependencies** | Locked schema design. |
| **Deliverables** | Migrated DB; Prisma client regenerated; empty settings seed; CI migrate check. |
| **Risk** | Partial unique indexes missed → duplicate active applications / emails. |
| **Complexity** | M |

---

## Phase 1 — Foundation

| | |
|--|--|
| **Goals** | Cross-cutting runtime: types, ScopeEngine, PermissionService, event bus + consumers (audit/timeline/notification stubs), settings read, nav entry behind flag, empty `/admin/recruitment` shell with `WorkspacePageHeader`. |
| **Dependencies** | Phase 0. |
| **Deliverables** | `lib/recruitment/permissions/*`, `events/*`, `types/*`, `services/settings-service`; sidebar item; middleware/access decision for assigned HM/TL on `/admin/recruitment`; ActionState wiring sample; unit tests for ScopeEngine. |
| **Risk** | HM/TL `employee` role vs `/admin` middleware — must resolve access without second route tree (architecture). |
| **Complexity** | L |

---

## Phase 2 — Job Openings

| | |
|--|--|
| **Goals** | CRUD Job Opening, headcount fields, status transitions, hiring team, job documents/notes, freeze `JobOpeningStage` from template. |
| **Dependencies** | Phase 1. |
| **Deliverables** | Routes `jobs/`, `jobs/[id]` tabs (Overview, Hiring Team, Documents, Notes, Timeline, Audit); actions in `recruitment-jobs`; job queries scoped. |
| **Risk** | Multiple hiring managers; must enforce ≤1 `hiring_manager` (partial unique). |
| **Complexity** | L |

---

## Phase 3 — Candidate Workspace

| | |
|--|--|
| **Goals** | Candidate CRUD, profile sections, documents/resume primary, tags, notes, chat (refresh), compensation gating, talent pool status, merge + duplicate engine (suggest-only), intake manual/CSV/referral. |
| **Dependencies** | Phase 1; Phase 2 helpful for linking intake→job. |
| **Deliverables** | `candidates/`, `candidates/[id]`, `talent-pool/`; intake actions; AI parse **queue storage** optional stub (full AI in Phase 3b or deferred with Phase 10). |
| **Risk** | Compensation leakage; merge data loss; soft-delete vs unique email. |
| **Complexity** | XL |

**Phase 3 split recommendation:** 3A profile+docs+notes · 3B intake+duplicate+merge · 3C chat+tags+talent pool · 3D AI parse Accept flow.

---

## Phase 4 — Applications

| | |
|--|--|
| **Goals** | Create Application (Candidate×Job), assignments, priority, risk flags shell, list/detail workspace, block duplicate active apps. |
| **Dependencies** | Phases 2–3. |
| **Deliverables** | `applications/`, `applications/[id]`; `ApplicationCreated` event; deep links to Candidate/Job. |
| **Risk** | Creating apps for do-not-hire candidates; Restrict deletes. |
| **Complexity** | M |

---

## Phase 5 — Pipeline

| | |
|--|--|
| **Goals** | PipelineEngine stage moves, stage history, hold/reject/withdraw/reopen, job pipeline board, bulk move (HR/SA), gates stubbed for decision/offer/hired. |
| **Dependencies** | Phase 4. |
| **Deliverables** | `recruitment-pipeline` actions; board on job detail Pipeline tab; `StageChanged` event. |
| **Risk** | Race concurrent stage moves; stage/status dual-field drift. |
| **Complexity** | L |

---

## Phase 6 — Interviews

| | |
|--|--|
| **Goals** | Schedule/reschedule/cancel/complete/no-show, panelists, feedback, attachments, interview list “today”, score rollup on Application. |
| **Dependencies** | Phase 4 (Phase 5 preferred). |
| **Deliverables** | `interviews/`, interview workspace; `InterviewScheduled` (+ related) events; feedback does **not** auto-advance stage. |
| **Risk** | Panelist without User mapping; feedback lock races. |
| **Complexity** | L |

---

## Phase 7 — Hiring Decision

| | |
|--|--|
| **Goals** | Versioned decisions, current flag, salary recommendation visibility, gate for Offer creation. |
| **Dependencies** | Phases 4–6 (feedback optional but expected). |
| **Deliverables** | Decision UI on Application/Candidate; `DecisionSubmitted`; Pipeline move to Decision/Offer coordination. |
| **Risk** | Multiple current decisions; TL submitting final decision (forbidden V1). |
| **Complexity** | M |

---

## Phase 8 — Offers

| | |
|--|--|
| **Goals** | Offer draft→approvals (skip HM if none)→released→accepted/declined/withdrawn; revisions; compensation field authz. |
| **Dependencies** | Phase 7. |
| **Deliverables** | `offers/` list + application offer panel; full OfferWorkflow; `OfferReleased` and sibling events. |
| **Risk** | Double active offers; skip-HM misuse; Released ≠ email (manual only). |
| **Complexity** | L |

---

## Phase 9 — Employee Conversion

| | |
|--|--|
| **Goals** | Convert accepted offer → Employee via **existing** provisioning; immutable `EmployeeConversionSnapshot`; Candidate link; stage Hired; idempotent. |
| **Dependencies** | Phase 8; existing `createEmployee` / `provisionEmployeeLogin` paths. |
| **Deliverables** | Conversion action + confirmation UI; `EmployeeConverted`; no AI path. |
| **Risk** | Duplicate Employee email; partial transaction (Employee created, snapshot failed); payroll field mapping ambiguity (V1: confirm map, avoid silent payroll writes). |
| **Complexity** | L |

---

## Phase 10 — Dashboard

| | |
|--|--|
| **Goals** | Recruitment home widgets (funnel, today’s interviews, open jobs, pending decisions, AI queue, activity, quick actions, velocity). |
| **Dependencies** | Phases 2–8 minimum; conversion optional for “recent offers/hires”. |
| **Deliverables** | `/admin/recruitment` page; dashboard queries + ScopeEngine; soft-launch feature flag on. |
| **Risk** | Expensive live aggregations — use bounded queries; metrics snapshots optional. |
| **Complexity** | M |

---

## Phase 11 — Reports

| | |
|--|--|
| **Goals** | V1 reports: Hiring Funnel, Time to Hire, Time in Stage, Source Effectiveness (basic). |
| **Dependencies** | Phase 5+ with meaningful data; metric snapshots writer preferred. |
| **Deliverables** | `reports/` pages; `RecruitmentReportQueryService`; ScopeEngine on all reports. |
| **Risk** | OLTP load; HM seeing unscoped org metrics. |
| **Complexity** | M |

---

## Phase 12 — Settings

| | |
|--|--|
| **Goals** | RecruitmentSettings UI, pipeline templates CRUD, SLA defaults, AI toggles, approval skip policy, HM compensation visibility flag. |
| **Dependencies** | Phase 1; templates used since Phase 2 (seeded). |
| **Deliverables** | `settings/` routes; `recruitment-settings` actions; SA/HR-limited. |
| **Risk** | Changing templates does not rewrite in-flight JobOpeningStage rows (freeze invariant). |
| **Complexity** | M |

---

### Recommended execution order (critical path)

```text
0 → 1 → 2 → 3A → 4 → 5 → 6 → 7 → 8 → 9 → 10
         ↘ 3B/3C parallel after 3A
12 can start after 1 (seeded settings) but polish after 2
11 after 5+ with data; AI (3D) can trail 10
```

---

# 2. Folder Mapping

Route group `(dashboard)` is required by ZEBL (URLs remain `/admin/recruitment/*`).

## 2.1 App routes

```text
src/app/(dashboard)/admin/recruitment/
  page.tsx                          # Dashboard (Phase 10; stub in Phase 1)
  loading.tsx
  error.tsx
  jobs/
    page.tsx
    [id]/
      page.tsx                      # Job Opening Workspace (tabs via query or nested)
  candidates/
    page.tsx
    [id]/
      page.tsx                      # Candidate Workspace
  applications/
    page.tsx
    [id]/
      page.tsx
  interviews/
    page.tsx
    [id]/
      page.tsx
  offers/
    page.tsx
    [id]/
      page.tsx                      # optional; may deep-link from application
  talent-pool/
    page.tsx
  reports/
    page.tsx
    [reportKey]/
      page.tsx                      # optional dynamic
  settings/
    page.tsx
```

## 2.2 Server actions (ZEBL convention — not under `lib/`)

```text
src/actions/
  recruitment-jobs.ts
  recruitment-candidates.ts
  recruitment-intake.ts
  recruitment-applications.ts
  recruitment-pipeline.ts
  recruitment-interviews.ts
  recruitment-decisions.ts
  recruitment-offers.ts
  recruitment-conversion.ts
  recruitment-collaboration.ts
  recruitment-ai.ts
  recruitment-settings.ts
```

## 2.3 Domain library (bounded subdomains)

```text
src/lib/recruitment/
  index.ts
  types/
    index.ts
    events.ts
    scope.ts
    dtos.ts
  permissions/
    permission-service.ts
    scope-engine.ts
  events/
    bus.ts
    catalog.ts
    consumers/
      audit-consumer.ts
      timeline-consumer.ts
      notification-consumer.ts
      analytics-consumer.ts
  job/
    job-opening-service.ts
    hiring-team-service.ts
    repository.ts
    queries.ts
  candidate/
    candidate-service.ts
    merge-service.ts
    intake-service.ts
    duplicate-engine.ts
    notes-service.ts
    chat-service.ts
    repository.ts
    queries.ts
  application/
    application-service.ts
    repository.ts
    queries.ts
  pipeline/
    pipeline-engine.ts
    repository.ts
  interview/
    interview-service.ts
    feedback-service.ts
    repository.ts
    queries.ts
  offer/
    offer-workflow.ts
    decision-service.ts
    repository.ts
    queries.ts
  conversion/
    employee-conversion-service.ts
    snapshot.ts
    repository.ts
  dashboard/
    queries.ts
  reports/
    report-query-service.ts
  services/
    settings-service.ts
    labels.ts
  ai/
    assist-service.ts
    parse-service.ts
    policy-guard.ts
```

## 2.4 Validators (existing ZEBL location)

```text
src/lib/validation/schemas/recruitment/
  jobs.ts
  candidates.ts
  applications.ts
  pipeline.ts
  interviews.ts
  decisions.ts
  offers.ts
  intake.ts
  conversion.ts
  collaboration.ts
  settings.ts
  ai.ts
  index.ts
```

## 2.5 UI components

```text
src/components/recruitment/
  dashboard/
  jobs/
  candidates/
  applications/
  interviews/
  offers/
  pipeline/
  intake/
  ai/
  shared/                    # StageBadge, CompGate, Empty states wrappers
```

## 2.6 Hooks

```text
src/hooks/
  use-recruitment-list-filters.ts
```

## 2.7 Notifications helper (consumer-only)

```text
src/lib/notifications/recruitment-notifications.ts
```

**Explicitly excluded:** `src/app/(dashboard)/employee/recruitment`, top-level `src/types/recruitment`, flat `lib/recruitment/repositories/` dump, co-located actions under `app/`.

---

# 3. Server Actions Plan

**Return type (all):** `ActionState` (`{ error?: string; success?: string }` plus optional id fields only when already established in ZEBL variants — prefer stick to `ActionState` unless a typed extension is approved).

**Common pipeline:** session guard → Zod (`safeParseWithSchema`) → PermissionService → Service → (commit) → publish event(s) → `revalidatePath` → return state.

**Audit / Notifications:** never called in actions; produced by event consumers.

---

### `recruitment-jobs.ts`

| Action | Validator | Permission | Service | Event(s) | Audit (consumer) | Notify (consumer) |
|--------|-----------|------------|---------|----------|------------------|-------------------|
| `createJobOpeningAction` | createJobOpeningSchema | SA/HR create | JobOpeningService.create | `JobOpeningCreated` | yes | optional owner |
| `updateJobOpeningAction` | updateJobOpeningSchema | SA/HR edit | JobOpeningService.update | `JobOpeningUpdated` | yes | — |
| `changeJobOpeningStatusAction` | changeJobStatusSchema | SA/HR | JobOpeningService.changeStatus | `JobOpeningStatusChanged` | yes | hiring team |
| `addHiringTeamMemberAction` | hiringTeamMemberSchema | SA/HR | HiringTeamService.add | `HiringTeamChanged` | yes | member |
| `removeHiringTeamMemberAction` | hiringTeamMemberIdSchema | SA/HR | HiringTeamService.remove | `HiringTeamChanged` | yes | — |
| `uploadJobDocumentAction` | jobDocumentSchema | SA/HR | JobOpeningService.addDocument | `JobDocumentUploaded` | yes | — |
| `deleteJobDocumentAction` | idSchema | SA/HR | soft-delete doc | `JobDocumentDeleted` | yes | — |
| `createJobNoteAction` | noteSchema | team+ | Notes (job) | `JobNoteCreated` | yes | mentions |
| `pinJobNoteAction` / `resolveJobNoteAction` | idSchema | author/HR | Notes | note events | yes | — |

---

### `recruitment-candidates.ts`

| Action | Validator | Permission | Service | Event(s) | Audit | Notify |
|--------|-----------|------------|---------|----------|-------|--------|
| `createCandidateAction` | createCandidateSchema | SA/HR | CandidateService.create | `CandidateCreated` | yes | — |
| `updateCandidateProfileAction` | profileSchema | SA/HR | CandidateService.updateProfile | `CandidateUpdated` | yes | — |
| `updateCandidateCompensationAction` | compensationSchema | SA/HR edit | CandidateService.updateCompensation | `CandidateCompensationUpdated` | yes | — |
| `setDoNotHireAction` | doNotHireSchema | SA/HR | CandidateService.setDoNotHire | `CandidateDoNotHireSet` | yes | recruiters |
| `mergeCandidatesAction` | mergeSchema | SA/HR | CandidateMergeService.merge | `CandidateMerged` | yes | recruiter |
| `uploadCandidateDocumentAction` | documentSchema | SA/HR | CandidateService.addDocument | `CandidateDocumentUploaded` | yes | — |
| `setPrimaryResumeAction` | documentIdSchema | SA/HR | CandidateService.setPrimaryResume | `PrimaryResumeChanged` | yes | — |
| `updateProfileSectionAction` | section schemas | SA/HR | CandidateService section CRUD | `CandidateUpdated` | yes | — |
| `manageCandidateTagsAction` | tagsSchema | SA/HR | CandidateService.tags | `CandidateTagged` | yes | — |

---

### `recruitment-intake.ts`

| Action | Validator | Permission | Service | Event(s) | Audit | Notify |
|--------|-----------|------------|---------|----------|-------|--------|
| `createManualIntakeAction` | manualIntakeSchema | SA/HR | IntakeService.manual | `IntakeCreated` | yes | — |
| `importCsvIntakeAction` | csvIntakeSchema | SA/HR | IntakeService.importCsv | `IntakeBatchCreated` | yes | — |
| `referralIntakeAction` | referralSchema | SA/HR | IntakeService.referral | `IntakeCreated` | yes | — |
| `resolveIntakeDuplicateAction` | resolveDupSchema | SA/HR | IntakeService.resolveDuplicate | `IntakeDuplicateResolved` | yes | — |
| `discardIntakeAction` | idSchema | SA/HR | IntakeService.discard | `IntakeDiscarded` | yes | — |
| `confirmIntakeToApplicationAction` | confirmIntakeSchema | SA/HR | IntakeService.confirm | `IntakeConfirmed`, may emit `ApplicationCreated` / `CandidateCreated` | yes | recruiter |

---

### `recruitment-applications.ts`

| Action | Validator | Permission | Service | Event(s) | Audit | Notify |
|--------|-----------|------------|---------|----------|-------|--------|
| `createApplicationAction` | createApplicationSchema | SA/HR | ApplicationService.create | `ApplicationCreated` | yes | recruiter/HM |
| `assignRecruiterAction` | assignRecruiterSchema | SA/HR | ApplicationService.assignRecruiter | `ApplicationAssigned` | yes | assignee |
| `assignManagerAction` | assignManagerSchema | SA/HR | ApplicationService.assignManager | `ApplicationAssigned` | yes | assignee |
| `setApplicationPriorityAction` | prioritySchema | SA/HR; HM limited | ApplicationService.setPriority | `ApplicationPriorityChanged` | yes | — |
| `reopenApplicationAction` | reopenSchema | SA/HR | ApplicationService.reopen | `ApplicationReopened` | yes | team |

---

### `recruitment-pipeline.ts`

| Action | Validator | Permission | Service | Event(s) | Audit | Notify |
|--------|-----------|------------|---------|----------|-------|--------|
| `moveStageAction` | moveStageSchema | SA/HR; HM if allowed stages | PipelineEngine.move | `StageChanged` | yes | recruiter/HM |
| `bulkMoveStageAction` | bulkMoveSchema | SA/HR | PipelineEngine.bulkMove | `StageChanged` ×N | yes | — |
| `holdApplicationAction` | holdSchema | SA/HR; HM request | PipelineEngine.hold | `StageChanged` | yes | — |
| `rejectApplicationAction` | rejectSchema | SA/HR | PipelineEngine.reject | `StageChanged` | yes | — |
| `withdrawApplicationAction` | withdrawSchema | SA/HR | PipelineEngine.withdraw | `StageChanged` | yes | — |

---

### `recruitment-interviews.ts`

| Action | Validator | Permission | Service | Event(s) | Audit | Notify |
|--------|-----------|------------|---------|----------|-------|--------|
| `scheduleInterviewAction` | scheduleSchema | SA/HR | InterviewService.schedule | `InterviewScheduled` | yes | panel |
| `rescheduleInterviewAction` | rescheduleSchema | SA/HR | InterviewService.reschedule | `InterviewRescheduled` | yes | panel |
| `cancelInterviewAction` | id+reason | SA/HR | InterviewService.cancel | `InterviewCancelled` | yes | panel |
| `completeInterviewAction` | idSchema | SA/HR | InterviewService.complete | `InterviewCompleted` | yes | — |
| `markInterviewNoShowAction` | idSchema | SA/HR | InterviewService.noShow | `InterviewNoShow` | yes | recruiter |
| `submitInterviewFeedbackAction` | feedbackSchema | panelist/HR/SA | InterviewFeedbackService.submit | `InterviewFeedbackSubmitted` | yes | recruiter |
| `updateInterviewFeedbackAction` | feedbackSchema | author/HR within lock | InterviewFeedbackService.update | `InterviewFeedbackUpdated` | yes | — |

---

### `recruitment-decisions.ts`

| Action | Validator | Permission | Service | Event(s) | Audit | Notify |
|--------|-----------|------------|---------|----------|-------|--------|
| `submitHiringDecisionAction` | decisionSchema | HM assigned / HR / SA | HiringDecisionService.submit | `DecisionSubmitted` | yes | recruiter |
| `reviseHiringDecisionAction` | reviseDecisionSchema | same | HiringDecisionService.revise | `DecisionSubmitted` | yes | — |

---

### `recruitment-offers.ts`

| Action | Validator | Permission | Service | Event(s) | Audit | Notify |
|--------|-----------|------------|---------|----------|-------|--------|
| `createOfferDraftAction` | offerDraftSchema | SA/HR | OfferWorkflow.createDraft | `OfferCreated` | yes | — |
| `updateOfferDraftAction` | offerDraftSchema | SA/HR | OfferWorkflow.updateDraft | `OfferUpdated` | yes | — |
| `submitOfferForApprovalAction` | idSchema | SA/HR | OfferWorkflow.submit | `OfferApprovalRequested` | yes | HM or HR |
| `approveOfferManagerAction` | id+comment | HM / SA | OfferWorkflow.approveManager | `OfferManagerApproved` | yes | HR |
| `approveOfferHrAction` | id+comment | HR / SA | OfferWorkflow.approveHr | `OfferHrApproved` | yes | recruiter |
| `rejectOfferApprovalAction` | id+reason | HM or HR step | OfferWorkflow.rejectApproval | `OfferApprovalRejected` | yes | recruiter |
| `markOfferReleasedAction` | idSchema | SA/HR | OfferWorkflow.release | `OfferReleased` | yes | HM/recruiter |
| `markOfferAcceptedAction` | idSchema | SA/HR | OfferWorkflow.accept | `OfferAccepted` | yes | HM |
| `markOfferDeclinedAction` | idSchema | SA/HR | OfferWorkflow.decline | `OfferDeclined` | yes | HM |
| `withdrawOfferAction` | id+reason | SA/HR | OfferWorkflow.withdraw | `OfferWithdrawn` | yes | HM |

---

### `recruitment-conversion.ts`

| Action | Validator | Permission | Service | Event(s) | Audit | Notify |
|--------|-----------|------------|---------|----------|-------|--------|
| `convertToEmployeeAction` | conversionSchema | SA/HR | EmployeeConversionService.convert | `EmployeeConverted` | yes | recruiter |

---

### `recruitment-collaboration.ts`

| Action | Validator | Permission | Service | Event(s) | Audit | Notify |
|--------|-----------|------------|---------|----------|-------|--------|
| `addCandidateNoteAction` | noteSchema | scoped team+ | NotesService.add | `NoteCreated` | yes | mentions |
| `pinCandidateNoteAction` / `resolveCandidateNoteAction` | idSchema | author/HR | NotesService | note events | yes | — |
| `postCandidateChatMessageAction` | chatSchema | scoped | ChatService.post | `ChatMessagePosted` | soft | mentions |
| `promoteChatToNoteAction` | idSchema | scoped | ChatService.promote | `ChatPromotedToNote` | yes | — |

---

### `recruitment-ai.ts`

| Action | Validator | Permission | Service | Event(s) | Audit | Notify |
|--------|-----------|------------|---------|----------|-------|--------|
| `requestResumeParseAction` | documentIdSchema | SA/HR | ResumeParseService.request | `AiParseRequested` | yes | recruiter when ready |
| `acceptAiDraftAction` | acceptAiSchema | SA/HR | AiAssistService.accept | `AiDraftAccepted` | yes | — |
| `dismissAiDraftAction` | idSchema | SA/HR | AiAssistService.dismiss | `AiDraftDismissed` | yes | — |
| `regenerateCandidateSummaryAction` | candidateIdSchema | SA/HR | AiAssistService.summary | `AiInsightGenerated` | yes | — |
| `regenerateJobMatchAction` | matchSchema | SA/HR | AiAssistService.jobMatch | `AiInsightGenerated` | yes | — |
| `requestDecisionDraftAction` | applicationIdSchema | HM/HR/SA | AiAssistService.decisionDraft | `AiInsightGenerated` | yes | — |

**AiPolicyGuard:** rejects any action attempting stage/reject/convert/approve/comms.

---

### `recruitment-settings.ts`

| Action | Validator | Permission | Service | Event(s) | Audit | Notify |
|--------|-----------|------------|---------|----------|-------|--------|
| `updateRecruitmentSettingsAction` | settingsSchema | SA; HR limited | SettingsService.update | `RecruitmentSettingsUpdated` | yes | — |
| `createPipelineTemplateAction` | templateSchema | SA/HR | SettingsService.createTemplate | `PipelineTemplateChanged` | yes | — |
| `updatePipelineTemplateAction` | templateSchema | SA/HR | SettingsService.updateTemplate | `PipelineTemplateChanged` | yes | — |

---

# 4. Business Services

Naming below matches architecture intent; “CreateXService” style is logical operation names inside the listed service modules.

| Service / operation | Inputs | Outputs | Domain events | Invariants | Failure cases |
|---------------------|--------|---------|---------------|------------|---------------|
| **JobOpeningService.create** | actor, job fields, templateId? | jobId | JobOpeningCreated | stages copied/frozen; openingsCount ≥ 1 | invalid template; unauthorized |
| **JobOpeningService.update** | actor, jobId, patch | void | JobOpeningUpdated | cannot mutate frozen stage rows via this API | not found; soft-deleted |
| **JobOpeningService.changeStatus** | actor, jobId, status, reason? | void | JobOpeningStatusChanged | legal status graph | illegal transition |
| **HiringTeamService.add/remove** | actor, jobId, employeeId, role | void | HiringTeamChanged | ≤1 hiring_manager | duplicate member; employee missing |
| **CandidateService.create/update*** | actor, profile fields | candidateId | CandidateCreated/Updated | email unique among live | duplicate email; DNH block on create app later |
| **CandidateService.updateCompensation** | actor, comp fields | void | CandidateCompensationUpdated | SA/HR only edit | TL/HM edit denied |
| **CandidateMergeService.merge** | actor, survivorId, loserId | survivorId | CandidateMerged | loser retired; apps re-pointed | both hired; cycle |
| **DuplicateCandidateEngine.suggest** | intake/candidate signals | matches[] | — (no write) | suggest-only | — |
| **IntakeService.*** | files/CSV/referral | intakeId / applicationId | Intake* , maybe ApplicationCreated | confirm before app | parse fail; unresolved dup |
| **ApplicationService.create** | actor, candidateId, jobId | applicationId | ApplicationCreated | job open; not DNH; no active dup | job closed; dup active |
| **ApplicationService.assign*** | actor, appId, assignee | void | ApplicationAssigned | assignee exists | unauthorized |
| **PipelineEngine.move** | actor, appId, toStage, note?, override? | void | StageChanged | enabled stages; gates for offer/hired | illegal move; concurrent version conflict |
| **PipelineEngine.hold/reject/withdraw** | actor, appId, reason | void | StageChanged | reason required | terminal already |
| **InterviewService.schedule** | actor, appId, schedule, panelistIds | interviewId | InterviewScheduled | ≥1 panelist; app exists | overlap warn (non-blocking V1) |
| **InterviewFeedbackService.submit** | actor employee, ratings | feedbackId | InterviewFeedbackSubmitted | panelist membership | duplicate feedback |
| **HiringDecisionService.submit/revise** | actor, outcome, text fields | decisionId | DecisionSubmitted | append-only versions; one isCurrent | TL final decision |
| **OfferWorkflow.createDraft** | actor, appId, package | offerId | OfferCreated | current decision ∈ {strong_hire,hire} unless SA override | missing decision |
| **OfferWorkflow.submit** | actor, offerId | void | OfferApprovalRequested | skip HM if none | wrong status |
| **OfferWorkflow.approve***/reject**/release/accept/decline/withdraw | actor, offerId, … | void | Offer* events | state machine; Released manual | wrong step actor |
| **EmployeeConversionService.convert** | actor, applicationId, field overrides? | employeeId, snapshotId | EmployeeConverted | offer accepted; snapshot immutable; idempotent | dup employee; provisioning fail |
| **NotesService / ChatService** | actor, body, visibility | ids | Note*/Chat* | visibility rules | private note leak |
| **Ai\* + PolicyGuard** | drafts | insightId | Ai* | never authoritative write without Accept | policy deny |
| **RecruitmentSettingsService** | patch | void | RecruitmentSettingsUpdated | singleton | unauthorized |
| **RecruitmentReportQueryService** | scope, filters | DTOs | — | ScopeEngine required | empty scope |

---

# 5. Repository Layer

## 5.1 Responsibilities

Repositories are the **only** modules that import Prisma for recruitment writes/reads of their aggregate (queries may use repositories or shared read helpers). Services orchestrate invariants and publish events; repositories do not publish events.

| Repository | Aggregate / tables | May call Prisma | Must not |
|------------|--------------------|-----------------|----------|
| `job/repository` | JobOpening, JobOpeningStage, HiringTeamMember, JobOpeningDocument, JobOpeningNote | yes | notify/audit |
| `candidate/repository` | Candidate + profile children, docs, tags, talent pool, AI insights, intake | yes | merge side-effects without service |
| `application/repository` | Application | yes | stage history writes (pipeline owns) |
| `pipeline/repository` | ApplicationStageHistory + Application stage columns | yes | decisions/offers |
| `interview/repository` | Interview, Panelist, Feedback, Attachment | yes | stage moves |
| `offer/repository` | HiringDecision, Offer, OfferRevision | yes | conversion |
| `conversion/repository` | EmployeeConversionSnapshot + candidate.employeeId link fields | yes | create Employee (call workforce APIs via service) |
| Settings via `services/settings-service` | RecruitmentSettings, templates | yes | — |
| Timeline / metrics | written by **event consumers** using prisma directly in consumer or tiny projection repos under `events/` | yes | called from business services |

## 5.2 Transaction boundaries

| Operation | Transaction scope |
|-----------|-------------------|
| Create JobOpening + stages + optional hiring team | Single interactive transaction |
| Merge candidates | Single TX: re-point FKs, soft-retire loser |
| Confirm intake → candidate ± application | Single TX |
| Pipeline move | Single TX: update Application + insert StageHistory |
| Schedule interview + panelists | Single TX |
| Submit decision (flip isCurrent) | Single TX |
| Offer status transition + revision snapshot | Single TX |
| **Conversion** | Single TX spanning: validate → create Employee (workforce) → snapshot → candidate link → application Hired — **or** saga with compensating action if Employee API cannot share Prisma TX; prefer one Prisma TX when provisioning is same DB |
| Event publish | **After** successful commit (see §10) |

Repositories accept optional `Prisma.TransactionClient`.

---

# 6. Domain Events

## 6.1 Bus rules

- Publisher: domain service after successful commit.
- Delivery V1: **in-process synchronous** fan-out to consumers (same request), with try/catch isolation per consumer (audit failure must not roll back business commit; log + dead-letter metric).
- Idempotency key: `{eventType}:{aggregateId}:{versionOrTimestampHash}` stored optionally in consumer cursors for retries.
- Ordering: per aggregate id — services must not emit out-of-order stage events for same application in parallel without locking.
- Retry: consumer failures → write `IntegrationJob` or structured log for replay worker (align with existing jobs). No infinite inline retry.

## 6.2 Expanded catalog

| Event | Publisher | Consumers | Payload (logical) | Idempotency | Ordering |
|-------|-----------|-----------|-------------------|-------------|----------|
| `JobOpeningCreated` | JobOpeningService | Audit, Timeline, Analytics | jobId, actorId, status | jobId create once | job |
| `JobOpeningUpdated` | JobOpeningService | Audit, Timeline | jobId, changedFields | eventId | job |
| `JobOpeningStatusChanged` | JobOpeningService | Audit, Timeline, Notification | jobId, from, to | status+at | job |
| `HiringTeamChanged` | HiringTeamService | Audit, Notification | jobId, employeeId, role, op | member key | job |
| `CandidateCreated` / `Updated` / `DoNotHireSet` / `CompensationUpdated` | CandidateService | Audit, Timeline | candidateId, … | eventId | candidate |
| `CandidateMerged` | MergeService | Audit, Timeline, Notification, Analytics | survivorId, loserId | merge pair | candidate |
| `IntakeCreated` / `BatchCreated` / `DuplicateResolved` / `Discarded` / `Confirmed` | IntakeService | Audit, Timeline, Notification | intakeId, … | intakeId+status | intake |
| `ApplicationCreated` | ApplicationService | **all four** | applicationId, candidateId, jobId | applicationId | application |
| `ApplicationAssigned` / `PriorityChanged` / `Reopened` | ApplicationService | Audit, Timeline, Notification | applicationId, … | eventId | application |
| `StageChanged` | PipelineEngine | **all four** | applicationId, from, to, override | appId+to+historyId | **strict per app** |
| `InterviewScheduled` / `Rescheduled` / `Cancelled` / `Completed` / `NoShow` | InterviewService | Audit, Timeline, Notification | interviewId, applicationId, startsAt | interviewId+type | interview |
| `InterviewFeedbackSubmitted` / `Updated` | FeedbackService | Audit, Timeline, Notification, Analytics | interviewId, authorEmployeeId | feedbackId | interview |
| `DecisionSubmitted` | DecisionService | **all four** | applicationId, decisionId, outcome, version | decisionId | application |
| `OfferCreated` / `Updated` / `ApprovalRequested` / `ManagerApproved` / `HrApproved` / `ApprovalRejected` | OfferWorkflow | Audit, Timeline, Notification | offerId, applicationId, status | offerId+status+at | offer |
| `OfferReleased` | OfferWorkflow | **all four** | offerId, applicationId | offerId released | offer |
| `OfferAccepted` / `Declined` / `Withdrawn` | OfferWorkflow | Audit, Timeline, Notification, Analytics | offerId, … | offerId+terminal | offer |
| `EmployeeConverted` | ConversionService | **all four** | snapshotId, employeeId, applicationId, candidateId | applicationId unique | application |
| `NoteCreated` / pinned/resolved / `ChatMessagePosted` / `ChatPromotedToNote` | Notes/Chat | Audit (notes), Timeline, Notification (mentions) | entity refs | eventId | candidate/job |
| `AiParseRequested` / `AiInsightGenerated` / `AiDraftAccepted` / `AiDraftDismissed` | AI services | Audit, Timeline, Notification (ready) | insightId | insightId | candidate |
| `RecruitmentSettingsUpdated` / `PipelineTemplateChanged` | Settings | Audit | settings keys | eventId | global |

Architecture minimum events remain mandatory; others are approved expansions under the same bus pattern.

---

# 7. Permission Matrix

**Roles:** Super Admin (SA), HR.  
**Capabilities:** Recruiter (HR user assigned as recruiter — still `hr` role), Hiring Manager (HM), Team Lead (TL), Interviewer (panelist).  
No new `UserRole`.

Legend: **F** full · **S** scoped via ScopeEngine · **O** own/participating · **—** none · **V** view · **E** edit · **C** create · **A** approve · **X** convert

| Feature | SA | HR / Recruiter | HM | TL | Interviewer |
|---------|----|----------------|----|----|-------------|
| Access `/admin/recruitment` | F | F | S* | S* | S* |
| Settings / templates | F | E limited | — | — | — |
| Job Opening CRUD | F | F | V S | V S | — |
| Hiring team manage | F | F | V | V | — |
| Candidate CRUD / merge / DNH | F | F | V S | V O | V O |
| Compensation view | F | F | V S | — | — |
| Compensation edit | F | F | — | — | — |
| Intake / CSV | F | F | — | — | — |
| Application create | F | F | — | — | — |
| Application view | F | F | V S | V S/O | V O |
| Priority edit | F | F | E limited | — | — |
| Stage move | F | F | E allowed set | — | — |
| Reject / withdraw | F | F | — | — | — |
| Schedule interview | F | F | — | — | — |
| Submit feedback | F | F | O | O | O |
| Hiring decision | F | F | A S | — | — |
| Offer draft/release/accept | F | F | — | — | — |
| Offer manager approve | F | — | A S | — | — |
| Offer HR approve | F | A | — | — | — |
| Convert employee | F | X | — | — | — |
| Talent pool | F | F | — | — | — |
| Dashboard / reports | F | F | S | light S | — |
| AI accept/dismiss | F | F | V summaries | — | — |
| Notes team | F | F | S | S | O |
| Notes HR-only / private | F | F / own private | — / — | — | — |

\*HM/TL/Interviewer reach admin recruitment only when ScopeEngine non-empty **and** platform access gate allows (Phase 1 decision), still **single** route tree.

---

# 8. Validation Strategy

| Layer | Mechanism | Examples |
|-------|-----------|----------|
| **UI** | Required attributes, disabled buttons by permission props, client length limits | Offer form disabled until decision exists |
| **Zod (actions)** | `src/lib/validation/schemas/recruitment/*` via `safeParseWithSchema` | enums, decimals, date ranges, id formats |
| **Business (services)** | Invariants in PipelineEngine / OfferWorkflow / Conversion | stage gates; skip HM; DNH; dup active app |
| **Database** | Enums, FKs, uniques, partial uniques, Restrict/Cascade | one current decision; snapshot uniqueness |
| **AI** | AiPolicyGuard + draft-only writes; Accept applies field whitelist | never Accept→stage move |

Validation failures return `ActionState.error` strings suitable for `ErrorAlert`; do not leak internal stack traces.

---

# 9. Caching Strategy

| Cache | Use | Invalidation |
|-------|-----|--------------|
| **React `cache()`** | `getSession`, `RecruitmentScopeEngine.resolve(actor)`, settings singleton | End of request (natural) |
| **RSC payload** | Page queries as default | `revalidatePath` on mutations for touched routes |
| **Dashboard** | Live bounded queries V1; optional read of `RecruitmentMetricSnapshot` | Path revalidate; snapshot refresh via Analytics consumer/worker |
| **Reports** | Prefer snapshots for heavy metrics; live for small filters | Snapshot recompute job; path revalidate on demand |
| **No Redis requirement V1** | — | — |
| **Do not cache** | Compensation across users; unresolved AI drafts globally; scope across actors | — |

After mutations, revalidate at least: entity detail, parent lists, `/admin/recruitment` when counts change.

---

# 10. Transaction Boundaries

```text
[Action]
  validate + authorize
  BEGIN Prisma transaction (when multi-row invariants)
    repository writes
  COMMIT
  publishRecruitmentEvent(...)     ← after commit
    consumers (audit, timeline, notify, analytics)
  revalidatePath(...)
  return ActionState
```

| Atomic (one TX) | After-commit events |
|-----------------|---------------------|
| Job + stages create | JobOpeningCreated |
| Stage move + history row | StageChanged |
| Decision version flip | DecisionSubmitted |
| Offer transition + revision | Offer* |
| Merge re-point | CandidateMerged |
| Conversion snapshot + links (+ Employee if same TX) | EmployeeConverted |

If Employee provisioning cannot join Prisma TX: create Employee → on success write snapshot in TX → on snapshot failure mark conversion failed and alert SA (compensating manual path); never publish `EmployeeConverted` without snapshot.

---

# 11. Performance Plan

| Area | Plan |
|------|------|
| **Indexes** | As schema design §6 (hiring team, applications by job+stage, candidates email/phone, interviews by schedule, timeline entity indexes, partial uniques) |
| **Pagination** | URL `page`/`cursor` + page size ≤ 50 for lists; keyset for chat/timeline |
| **Search** | Exact email/phone first; `fullName` ILIKE with index; trigram later |
| **Filtering** | Server `searchParams` + ScopeEngine AND filters |
| **N+1** | List queries select scalars only; board cards use Application summary fields; no per-row interview joins |
| **Lazy loading** | Candidate workspace tabs fetch section queries on demand |
| **Large datasets** | Never load all candidates client-side; metrics snapshots for dashboard funnel |
| **File access** | Signed/short-lived storage URLs; authz check before issuing |

---

# 12. Testing Strategy

| Layer | Focus |
|-------|-------|
| **Unit** | PipelineEngine transitions; OfferWorkflow skip-HM; ScopeEngine matrix; AiPolicyGuard; Zod schemas; decision versioning |
| **Integration** | Service + repository + Prisma test DB; event consumers write audit/timeline; merge; conversion idempotency |
| **Permission** | Matrix table automated; compensation omit; TL cannot decide/offer |
| **E2E** | Happy path: job → candidate → application → stages → interview → decision → offer → convert |
| **Migration** | Partial unique behaviors; enum expands; seed settings |
| **Performance** | Explain analyze on board query with seeded 50k apps; list p95 budget |
| **Edge cases** | Concurrent stage moves; double convert; offer without decision; DNH application; soft-deleted candidate email reuse; no-HM offer path |

---

# 13. Security Review

| Threat | Control |
|--------|---------|
| **Authorization bypass** | Action-level PermissionService + query ScopeEngine; deny by default |
| **Scope leaks** | Code review ban on raw `managerId` filters; tests for empty scope |
| **Mass assignment** | Zod pick lists; never pass raw FormData objects to Prisma |
| **Race: concurrent hiring / stage** | TX + conditional update on `currentStage` or version field; unique active offer |
| **Race: double conversion** | Unique snapshot on applicationId; pre-check employee email |
| **File access** | Authz on document id before storage fetch; offer/comp docs HR/SA |
| **Offer approval spoof** | Step-specific permission; skip HM only when team has zero HM at submit |
| **Employee conversion** | SA/HR only; snapshot immutable; no AI; audit `EmployeeConverted` |
| **Compensation** | Select omission + permission; timeline consumer scrub |
| **Chat/notes** | Visibility enum enforced in queries |
| **Admin route for employees** | Access gate + non-empty scope; still no second tree |

---

# 14. Rollout Plan

| Step | Detail |
|------|--------|
| **Feature flag** | `recruitment_module_enabled` (nav + layout); optional per-phase flags (`recruitment_offers_enabled`, `recruitment_conversion_enabled`) |
| **Migration order** | Enums → settings/templates → jobs/candidates → applications → interviews/decisions/offers → snapshot → timeline/metrics → NotificationType → partial SQL indexes |
| **Backfill** | None for greenfield; metrics worker after data exists; no fake candidates in prod |
| **Deployment order** | 1) migrate 2) deploy Phase 1 foundation (flag off) 3) enable for SA in staging 4) Phases 2–9 in staging E2E 5) Phase 10 flag on for HR pilot 6) conversion enabled last |
| **Rollback** | Flag off hides UI; DB migrations forward-only (no drop); stop conversion first if Employee pollution; event consumer bugs → disable notify consumer via config |
| **Monitoring** | Consumer error rates; conversion failure alerts; ScopeEngine empty-vs-admin anomalies |

---

## Team execution notes

1. Assign a **ScopeEngine owner** — every PR touching queries must include scope tests.  
2. Assign an **Events owner** — catalog + consumers stay coherent; ban direct `writeAuditLog` in services (lint rule if feasible).  
3. Conversion pairs with **workforce/Employee** owner for provisioning contract.  
4. Do not start Phase 8 until Phase 7 decision gate tests are green.  
5. Do not enable production flag until Phase 9 dry-run on staging with real Employee create path.

---

**End of implementation blueprint.**  
Locked PRD / Architecture / Schema Design remain authoritative. This document sequences work only; it does not alter those contracts.
