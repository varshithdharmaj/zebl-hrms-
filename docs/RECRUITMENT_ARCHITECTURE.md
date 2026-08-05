# ZEBL_HRMS — Recruitment Module Architecture

| Field | Value |
|-------|-------|
| **Document** | Recruitment Domain & System Architecture |
| **Status** | Architecture Approved (with amendments) |
| **Contract** | Bound to `docs/RECRUITMENT_PRD.md` (do not contradict) |
| **Frozen decisions** | Incorporated (headcount-as-fields, HM approval skip, compensation visibility, CSV Forms V1, refresh chat, assignment-based HM/TL) |
| **Approved amendments** | Single `/admin/recruitment/*` hierarchy; `EmployeeConversionSnapshot`; `RecruitmentScopeEngine`; domain events bus; bounded `lib/recruitment` subdomains |
| **Audience** | Staff engineers, tech leads, security review |
| **Out of scope for this doc** | Prisma schema, SQL, APIs, React, migrations, UI specs |

---

## Platform integration axioms

1. Recruitment is a **domain module** inside ZEBL_HRMS, not a parallel product.
2. Reuse: admin shell (`/admin/recruitment/*` only), `ActionState`, FormData + Zod, existing audit + notification infrastructure (via **domain event consumers**, not direct calls from business services), Employee provisioning (`createEmployee` / `provisionEmployeeLogin` path), three system roles only.
3. Pattern reference for list/permission/query split: **Helpdesk/tickets**. Pattern reference for stateful engines: **leave workflow**.
4. Never invent: new UserRole, realtime transport, candidate auth, separate audit store, separate notification bus, second route hierarchy under `/employee/recruitment`.
5. Every recruitment **query** resolves visibility through **RecruitmentScopeEngine**. Every major mutation publishes a **Recruitment domain event**; side effects (notify, audit, timeline, analytics) are consumers only.

---

# 1. High-level Domain Architecture

Recruitment is modeled as a **Hiring Workspace** with clear aggregate boundaries. The UI may center on Candidate Workspace; the **write-side integrity** centers on Job Opening (role context) and Application (pipeline unit).

## 1.1 Domain map

```text
Job Opening (role + hiring team + stage template instance)
    └── Application* (pipeline + assignments + decision + offer gate)
            ├── Interview* (rounds, feedback)
            ├── Hiring Decision* (versioned)
            └── Offer* (approval workflow)
Candidate (canonical person + profile + documents + collaboration)
    └── Application* (many)
    └── Employee link (0..1 after conversion)
    └── EmployeeConversionSnapshot (0..1, immutable)
Intake Item (transient operational object → Candidate ± Application)
```

## 1.2 Core concepts — responsibility, ownership, boundaries, relationships

### Candidate

| Aspect | Definition |
|--------|------------|
| **Responsibility** | Canonical **person** in hiring. Holds identity, profile sections, resumes, compensation expectations, availability, talent-pool membership, do-not-hire, collaboration threads scoped to the person. |
| **Ownership** | Owns person-level data only. Does **not** own pipeline stage. |
| **Boundaries** | No login. Not an Employee. Survives after hire as historical person linked to Employee. Merge is a Candidate-domain operation. |
| **Relationships** | 1 → N Applications; 1 → N Documents; 0..1 Employee (post-conversion); N Notes/Chat messages; AI drafts attach here until accepted into profile fields. |

### Application

| Aspect | Definition |
|--------|------------|
| **Responsibility** | The **pipeline unit**: Candidate applied (by HR) to one Job Opening. Owns current stage, stage history, priority, recruiter/manager assignment, risk flags, aggregated scores, and gates Decision/Offer/Hired for that job. |
| **Ownership** | Owns workflow state for one Candidate×Job pair. |
| **Boundaries** | Cannot exist without Candidate + Job Opening. Terminal states (Hired/Rejected/Withdrawn) are application-scoped; Candidate may still have other open applications. |
| **Relationships** | N → 1 Candidate; N → 1 Job Opening; 1 → N Interviews; 0..N Decision versions; 0..N Offers (typically one active); 0..1 EmployeeConversionSnapshot. |

### Job Opening

| Aspect | Definition |
|--------|------------|
| **Responsibility** | The **role** being hired: description, headcount **fields** (not separate entity), status, compensation band, stage template configuration, hiring team membership, job-level docs/notes/analytics scope. |
| **Ownership** | Owns role definition + who may participate (Hiring Team). Does not own person data or per-candidate stage. |
| **Boundaries** | Headcount request = fields on this aggregate (approved need flag, requested-by, requested-at, headcount count, urgency)—**not** a separate aggregate in V1. |
| **Relationships** | 1 → N Applications; 1 → N HiringTeamMember; 1 → N Job Documents/Notes. |

### Interview

| Aspect | Definition |
|--------|------------|
| **Responsibility** | A scheduled evaluation event for an Application: schedule, participants, links, artifacts, per-interviewer feedback, ratings, summary. |
| **Ownership** | Owned by Application (and thus indirectly Candidate + Job). |
| **Boundaries** | Completing feedback does **not** advance pipeline. Meeting links are stored; no auto-email to candidates. |
| **Relationships** | N → 1 Application; N participants (Employees/Users); feedback rows per participant. |

### Hiring Decision

| Aspect | Definition |
|--------|------------|
| **Responsibility** | Structured human judgment for an Application (Strong Hire / Hire / Borderline / Hold / Reject + rationale). |
| **Ownership** | Application-owned, **append-only versions** (latest current). |
| **Boundaries** | AI may draft; only humans submit. Gates Offer creation when policy requires Strong Hire/Hire. |
| **Relationships** | N versions → 1 Application; author is User. |

### Offer

| Aspect | Definition |
|--------|------------|
| **Responsibility** | Compensation package proposal and internal approval lifecycle (Draft → Manager Approval → HR Approval → Released → Accepted/Declined/Withdrawn). |
| **Ownership** | Application-owned active offer; prior offers retained as history. |
| **Boundaries** | “Released” means internally marked communicated—**no** candidate email automation. Manager step **skipped** when no Hiring Manager assigned. |
| **Relationships** | N → 1 Application; approval steps reference Users; Accepted enables Conversion. |

### Employee Conversion

| Aspect | Definition |
|--------|------------|
| **Responsibility** | Controlled handoff from hired Candidate/Accepted Offer into **existing** Employee (and optional User) provisioning. |
| **Ownership** | Orchestration via **EmployeeConversionService**; **Employee** remains owned by workforce/admin domain. |
| **Boundaries** | Must call existing provisioning paths—must not create a parallel employee store. AI cannot convert. Publishes `EmployeeConverted` (does not call notify/audit/timeline directly). |
| **Relationships** | Links Candidate ↔ Employee; references Application + Offer; creates **EmployeeConversionSnapshot**. |

### EmployeeConversionSnapshot

| Aspect | Definition |
|--------|------------|
| **Responsibility** | Immutable recruitment concept that stores the **exact conversion state** used when creating an Employee: field map version, source Candidate/Application/Offer ids, mapped values submitted to provisioning, resulting Employee id, actor, timestamp, override flags. |
| **Ownership** | Recruitment domain. Append-once; never updated in place. Corrections after hire happen on Employee, not by rewriting the snapshot. |
| **Boundaries** | Not an Employee record. Not editable by HR after success. Required outcome of a successful conversion. Used for audit reconstruction and dispute resolution. |
| **Relationships** | 1 → 1 Application (successful conversion); 1 → 1 Candidate; 1 → 1 Employee; references Offer used. |

---

# 2. Aggregate Design

## 2.1 Aggregate roots

| Aggregate root | Why |
|----------------|-----|
| **JobOpening** | Consistency boundary for role status, headcount fields, hiring team, and which stage template applies to new applications. Team membership changes are transactional with the opening. |
| **Candidate** | Consistency boundary for person identity, merge, profile sections, primary resume, compensation, do-not-hire. Prevents split-brain person records. |
| **Application** | Consistency boundary for **pipeline**: current stage, transition rules, assignments, decision gate, offer gate, hired lock. Highest write contention in hiring ops. |
| **IntakeItem** | Short-lived consistency boundary for import/upload/CSV rows until confirmed into Candidate (± Application). Isolates parse/duplicate review from live pipeline. |
| **RecruitmentSettings** (singleton/org config) | Stage defaults, SLA thresholds, AI toggles, approval skip rules. Separate so Job Openings clone config without mutating global defaults mid-flight incorrectly. |

### Not aggregate roots (entities/value objects inside parents)

| Entity | Contained by |
|--------|----------------|
| HiringTeamMember | JobOpening |
| JobDocument / JobNote | JobOpening |
| CandidateDocument / Profile sections / Skills | Candidate |
| CandidateNote / ChatMessage | Candidate |
| StageTransition | Application |
| Interview (+ Feedback) | Application |
| DecisionVersion | Application |
| Offer (+ ApprovalStep) | Application |
| **EmployeeConversionSnapshot** | Recruitment concept linked to Application + Candidate + Employee (immutable; not nested mutable state) |
| AiDraft / AiReviewItem | Candidate or IntakeItem (until accepted) |

### Interview as root?

**Rejected for V1.** Interviews are always application-scoped; scheduling invariants (round type vs stage, participant membership) are enforced through Application + JobOpening hiring team. A separate Interview root would invite orphan interviews and dual pipeline writes.

## 2.2 Invariants (must hold)

### JobOpening

1. Status ∈ {Draft, Open, On Hold, Closed, Filled} with legal transitions only.
2. Open applications count cannot exceed operational policy without explicit overfill (product default: warn, allow HR override audited).
3. Hiring Team may include at most one primary Hiring Manager (0..1); zero HM ⇒ offer manager-approval skip.
4. Stage configuration for the job is fixed for in-flight apps unless HR migrates with audited remap (V1: prefer freeze template at application create).

### Candidate

1. Strong identity keys (email/phone) unique among non-merged candidates (merge retires duplicates).
2. Do-not-hire blocks new Applications unless SA override.
3. Compensation fields readable only per frozen visibility matrix.
4. Profile “confirmed” fields change only via human edit or explicit Accept of AI draft—never silent AI write.
5. At most one linked Employee after conversion.

### Application

1. Exactly one Candidate and one Job Opening.
2. Unique open application per Candidate×Job (re-apply after terminal may be allowed as new application—policy; V1 recommend block duplicate active).
3. `currentStage` always matches last StageTransition.to (or initial).
4. Stage moves only through PipelineEngine with permission + rule checks.
5. Offer create requires latest Decision ∈ {Strong Hire, Hire} unless SA override.
6. Stage Hired requires Offer Accepted (or SA override).
7. Terminal stages are immutable except audited reopen.
8. AI never mutates stage.

### Offer

1. One **active** non-terminal offer per Application (Draft/in-approval/Released).
2. ManagerApproval skipped iff JobOpening has no Hiring Manager at submit time (frozen).
3. Accepted is terminal success for offer; enables conversion.

### Conversion / EmployeeConversionSnapshot

1. Preconditions validated before calling Employee provisioning.
2. Successful conversion **must** persist an **EmployeeConversionSnapshot** before/within the same transaction boundary as Employee create + link.
3. Snapshot is **immutable** after write (no update/delete in product paths; SA forensic retention only via platform policy).
4. Snapshot stores exact conversion state: map version, input values, ids (Candidate, Application, Offer), output Employee id, actor, overrides.
5. Idempotent: second convert attempt on same application fails closed unless already linked; existing snapshot is authoritative proof.

### IntakeItem

1. Cannot create Application until Candidate confirm path completed (new or merge).
2. Duplicate decision required when engine returns possible match above threshold.

---

# 3. Entity Ownership Rules

Exact ownership of information (write authority + source of truth):

| Information | Belongs to | Notes |
|-------------|------------|-------|
| Pipeline stage (current) | **Application** | Not Candidate, not Job |
| Stage history / transitions | **Application** | Append-only |
| Pipeline stage template / allowed stages | **JobOpening** (instance) + **RecruitmentSettings** (defaults) | Apps clone/freeze at create |
| Resume file + versions | **Candidate** | Application may reference primary at create time |
| Parsed profile drafts | **Candidate** / Intake until Accept | |
| Experience, Education, Skills, Projects, Certs | **Candidate** | |
| Compensation expectations | **Candidate** | Visibility: SA/HR edit; HM view assigned; TL none |
| Job compensation band | **JobOpening** | HR/SA |
| Offer package numbers | **Offer** | Separate from candidate expectations |
| Availability / notice | **Candidate** | |
| Priority, risk flags, recruiter/manager assign | **Application** | |
| Interview schedule, links, recordings refs | **Interview** ⊂ Application | |
| Interview feedback & ratings | **InterviewFeedback** ⊂ Interview | Author = interviewer |
| Aggregated score | **Application** (derived/cached) | Recompute on feedback change |
| Hiring Decision + history | **Application** | |
| Offer + approval trail | **Application** | |
| Employee link | **Candidate** ↔ **Employee** | Workforce owns Employee row |
| **EmployeeConversionSnapshot** | **Recruitment** (immutable concept) | Exact conversion state at Employee create; never rewritten |
| Headcount fields | **JobOpening** | Not separate entity |
| Hiring team membership | **JobOpening** | Source of HM/TL capability |
| Job-level notes/docs | **JobOpening** | |
| Person-level notes/chat | **Candidate** | |
| Timeline (operational) | Projection consumed from **domain events** (see §5.2 / §12) | |
| Audit (compliance) | Platform **AuditLog** via event consumers → `writeAuditLog` | entityType/entityId |
| AI queue items | Recruitment AI review store keyed to Candidate/Intake | |
| Notifications | Platform notification queue via event consumers | Payload refs recruitment ids |

**Rule of thumb:** If it answers “where is this person in hiring for this role?” → Application. If it answers “who is this person?” → Candidate. If it answers “what role are we filling?” → JobOpening.

---

# 4. Lifecycle Ownership

| Workflow | Owning aggregate / service | Triggered by |
|----------|----------------------------|--------------|
| Headcount capture | JobOpening fields | HR on create/edit |
| Open / close / fill job | JobOpening | HR/SA |
| Resume intake & parse review | IntakeItem → Candidate | HR upload/CSV/referral |
| Duplicate merge | Candidate (+ Intake) | HR decision |
| Create application | Application (factory under JobOpening rules) | HR |
| Stage progression | Application via **PipelineEngine** | HR/SA/(HM limited) |
| Interview lifecycle | Application / Interview | HR schedule; panel feedback |
| Hiring decision | Application | HM/HR/SA |
| Offer approvals | Offer via **OfferWorkflow** | HR submit; HM/HR approve |
| Employee conversion | **EmployeeConversionService** → provisioning + **EmployeeConversionSnapshot**; publishes `EmployeeConverted` | HR/SA |
| Archive / talent pool | Candidate status + Application terminal | System on reject/withdraw/hire |
| Collaboration | Candidate (notes/chat) or JobOpening (job notes) | Hiring team |

```text
JobOpening owns: role lifecycle
IntakeItem owns: pre-candidate confirmation lifecycle
Candidate owns: person lifecycle (including post-hire retention)
Application owns: evaluation lifecycle (stage → decision → offer → hired)
EmployeeConversionSnapshot owns: immutable record of handoff state (then workforce owns employment)
```

---

# 5. Domain Service Design

Responsibilities only. No implementation.

## 5.1 Core services

| Service | Responsibility |
|---------|----------------|
| **RecruitmentPermissionService** | Resolve actor capabilities for a **resource**: system role + hiring-team assignment + interview participation. Answer canView/canEdit/canMoveStage/canDecide/canApproveOffer/canConvert/canViewCompensation. Throw/map `PermissionError`. Does **not** build list filters (that is ScopeEngine). |
| **RecruitmentScopeEngine** | **Single authority for query visibility.** Resolves actor → `RecruitmentScope` (e.g. unrestricted for SA/HR; jobIds / applicationIds / candidateIds for HM/TL/interviewers). Every recruitment **read model / list / detail query** must obtain scope from this engine and apply it—**no** scattered `managerId` / `employeeId` / department checks in query modules. Request-dedupe via React `cache()` allowed. |
| **JobOpeningService** | Create/update/status transitions; headcount field updates; clone; close/fill; freeze stage config for apps. Publishes domain events where applicable. |
| **HiringTeamService** | Add/remove members; enforce single HM. |
| **CandidateService** | CRUD identity/profile sections; tags; do-not-hire; soft-delete; link documents; set primary resume. |
| **CandidateMergeService** | Merge duplicate candidates; re-point applications/docs; retire loser; publish `CandidateMerged`. |
| **IntakeService** | Create intake from upload/CSV/referral; track status; discard; promote to candidate/application. |
| **DuplicateCandidateEngine** | Score matches (email/phone/name+company); return suggestions with confidence; never merge itself. |
| **ResumeParseService** | Invoke AI parse; store drafts; never write confirmed fields. |
| **AiAssistService** | Summary, quality score, job match, decision draft, interview summary; enqueue AI review items; accept/dismiss apply. |
| **AiPolicyGuard** | Hard deny list: stage move, reject, overwrite, convert, approve, send comms. |
| **ApplicationService** | Create application; assign recruiter/manager; priority; risk recompute hooks; publish `ApplicationCreated`. |
| **PipelineEngine** | Validate and execute stage transitions; enforce gates (decision/offer/hired); record StageTransition; optional note on skip/back; SA override path; publish `StageChanged`. |
| **InterviewService** | Schedule/reschedule/cancel/complete/no-show; manage participants; attachments; publish `InterviewScheduled` (and related interview events as needed). |
| **InterviewFeedbackService** | Submit/edit feedback within lock rules; recompute application score. |
| **HiringDecisionService** | Append decision versions; validate authors; expose latest for offer gate; publish `DecisionSubmitted`. |
| **OfferWorkflow** | State machine including **skip ManagerApproval when no HM**; approvals; release/accept/decline/withdraw; publish `OfferReleased` (and other offer events as needed). Compensation field authz via PermissionService. |
| **EmployeeConversionService** | Preconditions; map fields; call existing Employee create/provision APIs; persist **EmployeeConversionSnapshot**; set Candidate↔Employee link; stage Hired; publish `EmployeeConverted`; never duplicate Employee silently. |
| **RecruitmentSettingsService** | Defaults for stages, SLAs, AI toggles, approval policies. |
| **ChatService** | Refresh-based thread CRUD on Candidate; mentions; promote-to-note; **no** websocket/SSE. |
| **NotesService** | Notes with visibility (team/private/HR-only), pin, resolve. |
| **RecruitmentReportQueryService** | Read models for funnel, time-to-hire, time-in-stage, source effectiveness (V1 subset); **must** apply RecruitmentScopeEngine. |

## 5.2 Domain events (mandatory)

Major actions publish **internal Recruitment domain events**. Business/domain services **must not** call notification helpers, audit writers, or timeline writers directly.

### Required event catalog (minimum)

| Event | Published when |
|-------|----------------|
| `ApplicationCreated` | Application successfully created |
| `StageChanged` | Pipeline stage transition committed |
| `InterviewScheduled` | Interview schedule created |
| `DecisionSubmitted` | Hiring decision version appended |
| `OfferReleased` | Offer marked Released |
| `CandidateMerged` | Candidate merge completed |
| `EmployeeConverted` | Employee provisioning + snapshot + link succeeded |

Additional events may be added later (e.g. offer approved, intake confirmed) without changing this bus pattern.

### Event flow

```text
Domain service (business logic)
    → commit aggregate write
    → publish RecruitmentDomainEvent
         ├── AuditEventConsumer        → writeAuditLog
         ├── TimelineEventConsumer     → timeline projection
         ├── NotificationEventConsumer → enqueueNotification / recruitment helpers
         └── AnalyticsEventConsumer    → metrics / future analytics hooks
```

| Component | Responsibility |
|-----------|----------------|
| **RecruitmentEventBus** (or `publishRecruitmentEvent`) | In-process publish API used by domain services after successful writes |
| **AuditEventConsumer** | Maps events → `writeAuditLog` / `recruitment.*` AUDIT_ACTIONS |
| **TimelineEventConsumer** | Maps events → operational timeline rows |
| **NotificationEventConsumer** | Maps events → existing notification queue |
| **AnalyticsEventConsumer** | Maps events → analytics/metrics hooks (may be no-op stubs in early V1) |

**Hard rule:** `ApplicationService`, `PipelineEngine`, `OfferWorkflow`, etc. depend on **event publish only**—not on `RecruitmentNotificationPublisher` or timeline services.

Cross-cutting: mutating services accept optional transaction client where platform already supports it; event publish occurs after successful commit (or within same unit-of-work policy defined at implementation—prefer after commit to avoid phantom notifications).

---

# 6. Permission Architecture

## 6.1 Integration with existing RBAC

```text
UserRole (unchanged)
  super_admin | hr | employee
        ↓
Middleware: /admin/* requires canAccessAdmin
  → /admin/recruitment/* is the ONLY Recruitment UI hierarchy
        ↓
RecruitmentPermissionService   (resource-level can*)
RecruitmentScopeEngine         (query visibility — mandatory for all reads)
  → uses:
      - role helpers in src/lib/permissions.ts
      - HiringTeamMember on JobOpening
      - Interview participant rows
      - Application assignments
```

**No new UserRole values.**

### Routing (approved)

| Rule | Detail |
|------|--------|
| **Single hierarchy** | All Recruitment pages live under `/admin/recruitment/*` |
| **Do not introduce** | `/employee/recruitment` or any second route tree |
| **HM / Team Lead access** | Via **domain permissions** + **RecruitmentScopeEngine** scoped queries (and middleware/session rules that allow assigned actors to reach `/admin/recruitment` as required by platform), **not** a parallel employee-shell module |

SA and HR retain full unrestricted scope. HM/TL see only assigned jobs/applications/candidates per ScopeEngine. Unassigned employees see nothing.

### Capability resolution

| Persona | How established |
|---------|-----------------|
| Super Admin | `role === super_admin` → unrestricted scope |
| HR | `role === hr` → unrestricted scope |
| Hiring Manager | HiringTeamMember.role = HiringManager on JobOpening (or Application.assignedManager) → scoped |
| Team Lead | HiringTeamMember.role = TeamLead **or** interview interviewer → scoped |
| Unassigned employee | No Recruitment data |

## 6.2 Compensation visibility (frozen)

| Actor | Compensation (Candidate + Offer package) |
|-------|------------------------------------------|
| Super Admin | View + Edit |
| HR | View + Edit |
| Hiring Manager (assigned) | View only |
| Team Lead | No access |

Enforced in PermissionService + query select omission + UI gating (defense in depth).

## 6.3 Offer manager skip (frozen)

OfferWorkflow reads JobOpening hiring team at submit: if no HM → transition Draft → HRApproval directly; audit metadata `managerApprovalSkipped: true`.

---

# 7. Folder Architecture

Align with existing `src/` layout. Types live under `lib/recruitment/types/`, not a new top-level `types/`. Organize `lib/recruitment` as **bounded subdomains** (not a flat service dump).

```text
src/
├── app/(dashboard)/
│   └── admin/recruitment/              # ONLY recruitment route hierarchy
│       ├── page.tsx                    # dashboard
│       ├── jobs/
│       ├── candidates/
│       ├── applications/
│       ├── interviews/
│       ├── offers/
│       ├── talent-pool/
│       ├── reports/
│       └── settings/
├── actions/
│   ├── recruitment-jobs.ts
│   ├── recruitment-candidates.ts
│   ├── recruitment-applications.ts
│   ├── recruitment-pipeline.ts
│   ├── recruitment-interviews.ts
│   ├── recruitment-decisions.ts
│   ├── recruitment-offers.ts
│   ├── recruitment-intake.ts
│   ├── recruitment-conversion.ts
│   ├── recruitment-collaboration.ts
│   ├── recruitment-ai.ts
│   └── recruitment-settings.ts
├── components/recruitment/
│   ├── dashboard/
│   ├── jobs/
│   ├── candidates/
│   ├── applications/
│   ├── interviews/
│   ├── offers/
│   ├── pipeline/
│   ├── intake/
│   ├── ai/
│   └── shared/
├── hooks/
│   └── use-recruitment-list-filters.ts
└── lib/
    ├── recruitment/
    │   ├── index.ts
    │   ├── types/
    │   │   ├── index.ts
    │   │   ├── events.ts                 # ApplicationCreated, StageChanged, …
    │   │   ├── scope.ts                  # RecruitmentScope DTO
    │   │   └── …
    │   ├── permissions/
    │   │   ├── permission-service.ts
    │   │   └── scope-engine.ts           # RecruitmentScopeEngine
    │   ├── events/
    │   │   ├── bus.ts                    # publishRecruitmentEvent
    │   │   ├── catalog.ts
    │   │   └── consumers/
    │   │       ├── audit-consumer.ts
    │   │       ├── timeline-consumer.ts
    │   │       ├── notification-consumer.ts
    │   │       └── analytics-consumer.ts
    │   ├── application/
    │   │   ├── application-service.ts
    │   │   └── queries.ts
    │   ├── candidate/
    │   │   ├── candidate-service.ts
    │   │   ├── merge-service.ts
    │   │   ├── intake-service.ts
    │   │   ├── duplicate-engine.ts
    │   │   ├── notes-service.ts
    │   │   ├── chat-service.ts
    │   │   └── queries.ts
    │   ├── job/                            # Job Opening bounded context
    │   │   ├── job-opening-service.ts
    │   │   ├── hiring-team-service.ts
    │   │   └── queries.ts
    │   ├── pipeline/
    │   │   └── pipeline-engine.ts
    │   ├── interview/
    │   │   ├── interview-service.ts
    │   │   ├── feedback-service.ts
    │   │   └── queries.ts
    │   ├── offer/
    │   │   ├── offer-workflow.ts
    │   │   ├── decision-service.ts
    │   │   └── queries.ts
    │   ├── conversion/                     # EmployeeConversionSnapshot + service
    │   │   ├── employee-conversion-service.ts
    │   │   └── snapshot.ts                 # snapshot shape / invariants (no Prisma here)
    │   ├── dashboard/
    │   │   └── queries.ts
    │   ├── reports/
    │   │   └── report-query-service.ts
    │   ├── services/                       # cross-cutting helpers shared by subdomains
    │   │   ├── settings-service.ts
    │   │   └── labels.ts
    │   └── ai/
    │       ├── assist-service.ts
    │       ├── parse-service.ts
    │       └── policy-guard.ts
    ├── validation/schemas/
    │   └── recruitment.ts
    ├── audit.ts                            # existing — used by audit consumer only
    └── notifications/
        └── recruitment-notifications.ts    # used by notification consumer only
```

**Do not** place domain writes in `components/` or raw Prisma in pages beyond thin query calls.  
**Do not** create `app/(dashboard)/employee/recruitment`.  
**Do not** scatter scope filters outside `RecruitmentScopeEngine`.

---

# 8. Server Action Architecture

Follow `ActionState` (`error?` / `success?`), FormData + Zod, auth guards, then domain service. Domain service publishes events; consumers handle audit/notify/timeline. Then `revalidatePath`.

```text
Action → guard → Zod → Domain service → publish event(s) → revalidatePath
                                      ↘ consumers (async/sync) handle side effects
```

## Action groups (names only)

| Group file | Action families |
|------------|-----------------|
| **recruitment-jobs** | createJobOpening, updateJobOpening, changeJobStatus, manageHiringTeam, uploadJobDocument, jobNote CRUD |
| **recruitment-candidates** | createCandidate, updateCandidateProfile, updateCompensation, setDoNotHire, mergeCandidates, document upload, setPrimaryResume |
| **recruitment-intake** | createManualIntake, importCsv, referralIntake, reviewParseDraft, resolveDuplicate, discardIntake, confirmIntakeToApplication |
| **recruitment-applications** | createApplication, assignRecruiter, assignManager, setPriority, reopenApplication |
| **recruitment-pipeline** | moveStage, bulkMoveStage (HR), holdApplication, rejectApplication, withdrawApplication |
| **recruitment-interviews** | scheduleInterview, reschedule, cancel, complete, noShow, submitFeedback, updateFeedback |
| **recruitment-decisions** | submitHiringDecision, reviseHiringDecision |
| **recruitment-offers** | createOfferDraft, updateOfferDraft, submitOfferForApproval, approveOfferManager, approveOfferHr, rejectOfferApproval, markOfferReleased, markOfferAccepted, markOfferDeclined, withdrawOffer |
| **recruitment-conversion** | convertToEmployee (writes EmployeeConversionSnapshot) |
| **recruitment-collaboration** | addNote, pinNote, resolveNote, postChatMessage, promoteChatToNote |
| **recruitment-ai** | requestResumeParse, acceptAiDraft, dismissAiDraft, regenerateSummary, regenerateJobMatch, requestDecisionDraft |
| **recruitment-settings** | updateRecruitmentSettings, updateStageDefaults |

**Non-goals for actions:** AI auto-stage-move endpoints; candidate-facing endpoints; realtime subscribe endpoints; direct notify/audit calls.

---

# 9. Query Layer Architecture

## 9.1 Principles

- **Server Components** call subdomain `queries.ts` modules under `lib/recruitment/{application,candidate,job,interview,offer,dashboard,reports}/`.
- Mutations never live in query modules.
- **Every** recruitment query (list, detail, dashboard widget, report) must:
  1. Resolve `RecruitmentScope` via **RecruitmentScopeEngine**.
  2. Apply that scope to the query.
  3. Fail closed if scope is empty for non-privileged actors.
- **Forbidden:** ad-hoc `where: { managerId }`, `employeeId`, or department filters sprinkled in query files.
- URL `searchParams` drive filters/pagination (tickets pattern) **in addition to** scope.
- Compensation columns omitted unless `canViewCompensation` (PermissionService).

## 9.2 Read model organization

| Query home | Consumers | Notes |
|------------|-----------|-------|
| `dashboard/queries` | `/admin/recruitment` | Widgets; ScopeEngine for HM/TL |
| `job/queries` | Jobs pages | |
| `candidate/queries` | Candidate workspace + talent pool | |
| `application/queries` | Applications + pipeline board | |
| `interview/queries` | Interviews | |
| `offer/queries` | Offers | Comp fields conditional |
| `reports/report-query-service` | Reports | Scoped aggregations |
| Timeline reads | Via timeline projection store | Still ScopeEngine-gated by parent entity |
| AI queue | Dashboard | HR/SA unrestricted |

## 9.3 Derived data

- Days-in-stage, funnel counts, velocity: compute in SQL aggregations or maintained summary tables later—**V1** may compute on read with indexes; **scale path** (§14) introduces summary tables without changing aggregate boundaries. Analytics consumers may also project from domain events.

---

# 10. Notification Integration

Reuse `enqueueNotification` and helpers in `src/lib/notifications/recruitment-notifications.ts`.

## 10.1 Extension points

1. Add Recruitment values to platform `NotificationType` enum (migration when implementing—not in this doc).
2. Implement notification **helpers** for channel/payload shaping.
3. **Only** `NotificationEventConsumer` (events subdomain) calls those helpers—never domain services or actions directly.

## 10.2 Event → notification map (consumer-driven)

| Domain event (and related) | Consumer notifies |
|----------------------------|-------------------|
| `InterviewScheduled` (+ reschedule/cancel variants if added) | Participants + recruiter |
| Interview reminder due | Participants (scheduled enqueue) |
| Feedback pending | Interviewer |
| `StageChanged` | Recruiter + HM (configurable) |
| Assignment changes (future/related events) | Assignee |
| `DecisionSubmitted` / decision pending | HM / recruiter |
| Duplicate found | Recruiter |
| Resume parse ready | Recruiter |
| Offer approval requested | HM or HR |
| `OfferReleased` (+ accepted/declined/withdrawn variants) | Recruiter (+ HM) |
| `EmployeeConverted` | Recruiter |
| `CandidateMerged` | Recruiter (optional) |
| Mention in note/chat | Mentioned user |
| Application SLA stale | Recruiter + HM |

**Channels:** Prefer in-app / existing employee channels. **Never** enqueue candidate-outbound email as a Recruitment feature.

Payload must include deep-link under `/admin/recruitment/...` + entity ids.

---

# 11. Audit Integration

Reuse `writeAuditLog` in `src/lib/audit.ts`. Extend `AUDIT_ACTIONS` with `recruitment.*` dotted keys.

**Only** `AuditEventConsumer` writes audit logs from published domain events (plus any platform-level security events). Domain services do not call `writeAuditLog` directly.

## 11.1 Audit event catalog (minimum)

| Action key (illustrative) | When / source event |
|---------------------------|---------------------|
| `recruitment.job.created` / `updated` / `status_changed` | Job Opening |
| `recruitment.job.team_changed` | Hiring team |
| `recruitment.candidate.created` / `updated` / `do_not_hire` | Candidate |
| `recruitment.candidate.merged` | `CandidateMerged` |
| `recruitment.intake.created` / `discarded` / `confirmed` | Intake |
| `recruitment.intake.duplicate_resolved` | Duplicate decision |
| `recruitment.ai.parse_requested` / `draft_accepted` / `draft_dismissed` | AI |
| `recruitment.application.created` / `assigned` / `priority_changed` | `ApplicationCreated` + related |
| `recruitment.pipeline.stage_moved` | `StageChanged` |
| `recruitment.application.reopened` / `held` / `rejected` / `withdrawn` | Terminal/hold |
| `recruitment.interview.scheduled` / `updated` / `completed` / `cancelled` | `InterviewScheduled` + related |
| `recruitment.interview.feedback_submitted` | Feedback |
| `recruitment.decision.submitted` / `revised` | `DecisionSubmitted` |
| `recruitment.offer.created` / `submitted` / `approved` / `rejected` / `released` / `accepted` / `declined` / `withdrawn` | Offer lifecycle incl. `OfferReleased` |
| `recruitment.offer.manager_skipped` | Skip path metadata |
| `recruitment.conversion.completed` / `failed` | `EmployeeConverted` / failure path |
| `recruitment.conversion.snapshot_written` | EmployeeConversionSnapshot persisted |
| `recruitment.note.*` / `recruitment.chat.*` | Collaboration |
| `recruitment.settings.updated` | Settings |
| `recruitment.document.downloaded` | Sensitive downloads |
| `recruitment.override.*` | SA break-glass |

Store `oldValue`/`newValue` for stage, offer status, decision outcome, compensation edits. Snapshot id referenced on conversion audit rows.

---

# 12. Timeline Architecture

| | **Timeline** | **Audit** |
|--|--------------|-----------|
| Purpose | Human operational story in workspaces | Compliance / security immutable log |
| Audience | Recruiters, HM, TL | HR/SA, security, investigations |
| Content | Readable summaries (“Moved to Technical Round”) | Structured action keys + before/after + request context |
| Mutability | Append-only projection from domain events | Append-only platform log; never edited |
| Completeness | Curated subset useful in product UI | Superset including sensitive/system events |
| Storage | Recruitment timeline event store (domain) | Existing `AuditLog` |
| Writer | **TimelineEventConsumer only** | **AuditEventConsumer only** |

**Rule:** Domain services publish events. Consumers project Timeline and Audit. Pure permission failures do not publish business events.

Timeline queries are ScopeEngine-gated via parent entity visibility. Private/HR-only notes appear on timeline only for authorized viewers.

---

# 13. Caching Strategy

Match current ZEBL practice: React `cache()` for **request dedupe**, `revalidatePath` after mutations—not a separate Redis cache for V1.

| Mechanism | Use for Recruitment |
|-----------|---------------------|
| **`cache()` (React)** | Wrap `getSession`, **RecruitmentScopeEngine.resolve**, settings load—same as `employeeHasDirectReports` pattern. |
| **Server Components** | Default data loaders for pages under `/admin/recruitment`; pass DTOs to client islands. |
| **`revalidatePath`** | After every successful mutation: precise `/admin/recruitment/...` paths + dashboard. |
| **`revalidateTag` (optional later)** | Only if tagged `unstable_cache` introduced for report aggregates—**not required for V1**. |
| **Client state** | Filter URL state; chat refetch on navigation/manual refresh; no realtime bus. |
| **Do not cache** | Compensation across unauthorized actors; AI drafts without authz; scope longer than request without recheck on mutation. |

Pipeline board: load via RSC; moves via server action + event publish + revalidate; avoid optimistic stage moves that skip PipelineEngine.

---

# 14. Scalability Considerations

Targets: **100k Candidates**, **50k Applications**, large hiring teams—**without changing aggregate boundaries**.

| Concern | V1-safe design | Scale evolution (same architecture) |
|---------|----------------|-------------------------------------|
| List pages | Cursor/offset pagination + indexed filters (stage, jobId, recruiterId, updatedAt) | Same queries; add covering indexes |
| Pipeline board | Query by `jobId` + group by stage in app or SQL | Materialized stage counts per job |
| Candidate search | B-tree on email/phone; trigram/name later | External search optional; semantic search V2 feature, not new root |
| Duplicate engine | Exact email/phone first; expensive fuzzy async on intake | Queue fuzzy matching worker |
| Timeline | Index `(entityType, entityId, at DESC)` | Partition by time if needed |
| Audit | Existing table; recruitment volume additive | Same retention policies as platform |
| Chat | Paginated messages per candidateId | Archive cold threads; still refresh-based |
| Hiring team fanout | Members table indexed by employeeId + jobId | **RecruitmentScopeEngine** resolves jobIds once per request via `cache()` |
| Reports | On-read aggregation with date bounds | Nightly summary tables / worker; ReportQueryService absorbs |
| Conversion | Rare path; transactional | Unchanged |
| AI | Async job + AI queue table | Worker pool; still Accept-gated |

**Hard architectural constraints that protect scale:** Application owns stage (avoids rewriting Candidate on every move); Intake isolated from hot Candidate rows; no WebSocket fanout; list URLs server-filtered.

**Anti-patterns to forbid:** Loading all applications into client memory (employees-list anti-pattern); unbounded dashboard activity feed; N+1 feedback loads on board cards (use summary fields on Application).

---

# 15. Architectural Risks

| Risk | Tradeoff | Mitigation |
|------|----------|------------|
| HM/TL need `/admin/recruitment` without being HR | Middleware/`canAccessAdmin` vs assignment-only access | Keep **single** `/admin/recruitment/*` tree; extend access gate for assigned actors as needed; **always** ScopeEngine + PermissionService—never a second route hierarchy |
| Scattered visibility filters | Speed of coding vs leaks | **RecruitmentScopeEngine** mandatory on every query; code review rejects ad-hoc managerId filters |
| Business logic calling notify/audit directly | Coupling vs “just works” | Domain **events** + consumers only; forbid direct side-effect calls in services |
| Candidate-centric UI vs Application-centric writes | UX vs invariant safety | UI Candidate Workspace; mutations via Application/Pipeline/Offer services |
| Dual history (Timeline + Audit) | Storage vs clarity | Both projected from same events; Timeline curated; Audit is compliance source |
| Offer/Decision gates slow hiring | Control vs speed | SA override with mandatory reason + event/audit |
| Duplicate false positives | Safety vs friction | Suggest-only; HR choice; confidence display |
| AI trust creep | Productivity vs bad hires | AiPolicyGuard + Accept UX; events on accept/dismiss |
| Conversion field-map drift | Convenience vs integrity | **EmployeeConversionSnapshot** immutable exact state; provisioning only via existing APIs |
| Compensation leakage | HM context vs privacy | PermissionService + query omission; TL denied |
| CSV Forms V1 fragility | Speed vs fidelity | Mapping docs; V1.5 connector without domain redesign |
| Refresh chat UX | Simplicity vs polish | Mentions via notification consumer; no WS |
| Large hiring teams | Permission complexity | ScopeEngine centralization + indexes |
| PipelineEngine god-object | Centralization vs modularity | Pure transitions; side effects only via events |
| Report load on OLTP | Analytics vs ops | Date bounds V1; event-driven summaries later |
| Reopen/terminal edge cases | Flexibility vs quality | Explicit reopen; audited via events |

---

## Architecture review checklist (gate before schema / coding)

- [x] Aggregates and invariants accepted  
- [x] **Single route hierarchy:** `/admin/recruitment/*` only (no `/employee/recruitment`)  
- [x] **EmployeeConversionSnapshot** immutable conversion concept  
- [x] **RecruitmentScopeEngine** mandatory for all queries  
- [x] **Domain events** + consumers for notify / audit / timeline / analytics  
- [x] **Bounded subdomains** under `lib/recruitment/`  
- [ ] NotificationType / AUDIT_ACTIONS extension plan at schema/impl phase  
- [ ] Conversion maps to existing Employee provisioning entry points  
- [ ] Compensation visibility enforced in permission + query layers  
- [ ] No realtime, no candidate portal, no new UserRole  
- [ ] PRD frozen decisions unchanged  

---

**End of architecture document.**  
Next phase: production Prisma schema design realizing these aggregates, `EmployeeConversionSnapshot`, and event/timeline projection needs—without altering ownership or routing rules.
