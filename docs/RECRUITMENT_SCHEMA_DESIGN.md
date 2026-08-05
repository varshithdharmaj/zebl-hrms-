# ZEBL_HRMS — Recruitment Prisma Schema Design

| Field | Value |
|-------|-------|
| **Document** | Production database model design (design phase only) |
| **Status** | Schema Proposal — Pre-Migration |
| **Bound to** | `docs/RECRUITMENT_PRD.md`, `docs/RECRUITMENT_ARCHITECTURE.md` (immutable; not modified) |
| **Out of scope** | Migrations, APIs, UI, service implementation |
| **Platform** | PostgreSQL + Prisma (append to existing `prisma/schema.prisma`) |

---

## Design challenges (resolved before finalizing)

| Challenge | Weak option | Decision |
|-----------|-------------|----------|
| **Headcount Request table** | Separate `HeadcountRequest` model | **Rejected.** Architecture freezes headcount as **fields on `JobOpening`**. No separate entity in V1. |
| **Global File / Department models** | Invent platform File/Department | **Rejected.** No such models exist. Department remains `String` (same as `Employee.department` / `Ticket.department`). Documents are recruitment-owned rows with storage keys. |
| **Resume as separate root** | `Resume` aggregate parallel to documents | **Rejected.** Resume = `CandidateDocument` with `documentType = resume` + `isPrimary` + versioning. Avoids dual storage. |
| **Talent Pool as only a boolean** | `Candidate.inTalentPool` alone | **Accepted with enrichment:** boolean/status on Candidate **plus** optional `TalentPoolEntry` history (reason, enteredAt, source application) for reports without losing auditability. |
| **Pipeline stage as free string** | Unconstrained `String` stage | **Rejected.** Use enum `RecruitmentPipelineStage` for system stages + `PipelineTemplate` / per-job stage rows for ordering/optionality. Application stores `currentStage` enum. |
| **Offer without Decision FK** | Soft invariant only in code | **Hardened.** `Offer.hiringDecisionId` **required**. App layer still enforces Decision ∈ {Strong Hire, Hire}. |
| **Soft delete vs ZEBL norms** | ZEBL largely uses status/`isActive`, not `deletedAt` | **Recruitment introduces `deletedAt`** on mutable ops entities (Candidate, JobOpening, Application, Notes, Documents). Immutable rows (stage history, decisions, conversion snapshot, timeline, offer revisions) have **no** soft delete. Documented as intentional extension. |
| **Dashboard aggregates live query only** | No summary tables until pain | **Include** `RecruitmentMetricSnapshot` (mirrors `WorkforceMetric`) so 100k+ scale does not force architecture change later. V1 writers may be sparse. |
| **Polymorphic timeline only** | Drop structured stage history | **Both.** `ApplicationStageHistory` = pipeline integrity; `RecruitmentTimelineEvent` = UX projection from domain events. |
| **Int vs cuid IDs** | Mix randomly | **cuid `String` @id** for all new recruitment models (Ticket/Audit pattern). FKs to `Employee.id` remain `Int`. |
| **Json vs String metadata** | All Json | Follow platform: structured blobs as `Json` where queried/partial-updated (`EmployeeConversionSnapshot.mappedFields`, AI payloads); otherwise `String @default("{}")` like tickets when opaque. Prefer `Json` for snapshot/AI for type-safe reads. |

---

# 1. Domain Model Diagram (text)

```text
RecruitmentSettings (singleton)
RecruitmentPipelineTemplate 1──* PipelineTemplateStage

JobOpening *──1 PipelineTemplate? (optional source)
JobOpening 1──* JobOpeningStage          (frozen stage config for this job)
JobOpening 1──* HiringTeamMember *──1 Employee (+ User via Employee)
JobOpening 1──* JobOpeningDocument
JobOpening 1──* JobOpeningNote
JobOpening 1──* Application

Candidate 1──* CandidateDocument         (includes resume versions)
Candidate 1──* CandidateExperience
Candidate 1──* CandidateEducation
Candidate 1──* CandidateSkill
Candidate 1──* CandidateProject
Candidate 1──* CandidateCertification
Candidate 1──* CandidateNote
Candidate 1──* CandidateChatMessage
Candidate 1──* CandidateTag *──1 RecruitmentTag
Candidate 1──* TalentPoolEntry
Candidate 1──* CandidateAiInsight
Candidate 1──* Application
Candidate 0..1──0..1 Employee            (post-conversion link)
Candidate 0..1──0..1 EmployeeConversionSnapshot

IntakeItem 0..1──0..1 Candidate
IntakeItem 0..1──0..1 JobOpening

Application *──1 JobOpening
Application *──1 Candidate
Application *──1 JobOpeningStage?        (optional pointer to config row)
Application 1──* ApplicationStageHistory
Application 1──* Interview 1──* InterviewPanelist
Application     Interview 1──* InterviewFeedback
Application     Interview 1──* InterviewAttachment
Application 1──* HiringDecision          (versioned; latest flagged)
Application 1──* Offer *──1 HiringDecision
Application     Offer 1──* OfferRevision
Application 0..1──0..1 EmployeeConversionSnapshot

RecruitmentTimelineEvent (polymorphic entityType/entityId)
RecruitmentMetricSnapshot (dashboard/report aggregates)
RecruitmentSavedFilter (per User)
```

---

# 2. Entity Relationship Explanation

| Relation | Cardinality | Why |
|----------|-------------|-----|
| JobOpening → Application | 1:N | Each opening receives many applications; pipeline is per application. |
| Candidate → Application | 1:N | One person may apply to many jobs. |
| Application → JobOpening + Candidate | N:1 each | Application is the Candidate×Job join + pipeline owner. |
| JobOpening → HiringTeamMember | 1:N | ScopeEngine + HM/TL capabilities; members are Employees. |
| JobOpening → JobOpeningStage | 1:N | Per-job frozen ordered stages (optional flags). |
| PipelineTemplate → PipelineTemplateStage | 1:N | Reusable custom pipelines; copied onto JobOpening at create. |
| Application → ApplicationStageHistory | 1:N | Append-only stage transitions (integrity). |
| Application → Interview | 1:N | No interview without application. |
| Interview → InterviewPanelist | 1:N | Panel membership for feedback + scope. |
| Interview → InterviewFeedback | 1:N | One feedback row per panelist (unique). |
| Application → HiringDecision | 1:N | Versioned decisions; `isCurrent` marks latest. |
| Offer → HiringDecision | N:1 | **Required** — no offer without a decision row. |
| Application → Offer | 1:N | Active + historical offers; one non-terminal active enforced in app. |
| Offer → OfferRevision | 1:N | Package/edit history without mutating forensic trail incorrectly. |
| EmployeeConversionSnapshot → Application/Candidate/Offer/Employee | N:1 | Immutable conversion proof; 1 successful snapshot per application. |
| Candidate → profile children | 1:N | Experience, education, skills, projects, certs owned by Candidate. |
| Candidate ↔ RecruitmentTag | M:N | Tags via `CandidateTag`. |
| Candidate → TalentPoolEntry | 1:N | Pool history; Candidate also has pool status fields. |
| Candidate → CandidateAiInsight | 1:N | Assistive AI drafts/scores; never authoritative alone. |
| IntakeItem → Candidate/JobOpening | optional | Pre-confirm intake queue. |
| TimelineEvent | polymorphic | UX projection; not FK-heavy to every aggregate. |
| MetricSnapshot | none/loose | Pre-aggregated dashboard/report facts. |
| SavedFilter → User | N:1 | Per-user saved list filters. |

**Ownership reminder**

- **Application owns:** stage, interviews, decisions, offers, conversion snapshot link.
- **Candidate owns:** profile, documents/resume, notes/chat, tags, AI insights, talent pool entries.
- **JobOpening owns:** hiring team, headcount fields, location, openings count, employment type, job docs/notes, stage config rows.

---

# 3. Complete Model List

### Config / templates

1. `RecruitmentSettings`
2. `RecruitmentPipelineTemplate`
3. `PipelineTemplateStage`

### Job opening

4. `JobOpening`
5. `JobOpeningStage`
6. `HiringTeamMember`
7. `JobOpeningDocument`
8. `JobOpeningNote`

### Candidate

9. `Candidate`
10. `CandidateDocument`
11. `CandidateExperience`
12. `CandidateEducation`
13. `CandidateSkill`
14. `CandidateProject`
15. `CandidateCertification`
16. `CandidateNote`
17. `CandidateChatMessage`
18. `RecruitmentTag`
19. `CandidateTag`
20. `TalentPoolEntry`
21. `CandidateAiInsight`
22. `IntakeItem`

### Application & pipeline

23. `Application`
24. `ApplicationStageHistory`

### Interview

25. `Interview`
26. `InterviewPanelist`
27. `InterviewFeedback`
28. `InterviewAttachment`

### Decision / offer / conversion

29. `HiringDecision`
30. `Offer`
31. `OfferRevision`
32. `EmployeeConversionSnapshot`

### Cross-cutting projections / UX

33. `RecruitmentTimelineEvent`
34. `RecruitmentMetricSnapshot`
35. `RecruitmentSavedFilter`

### Platform extensions (not new models)

- Extend `NotificationType` enum with recruitment values.
- Add reverse relation fields on `User` and `Employee` only (no new User/Employee/AuditLog/Notification tables).

**Not modeled as tables (by design)**

| Requested concept | Realization |
|-------------------|-------------|
| Headcount Request | Fields on `JobOpening` |
| Resume | `CandidateDocument` (`resume`) |
| Application Timeline | `RecruitmentTimelineEvent` + `ApplicationStageHistory` |
| Reports | Queries + `RecruitmentMetricSnapshot` |
| Department | `String` columns |
| File | Storage metadata on document/attachment models |
| Role | Existing `UserRole` + `HiringTeamRole` enum |

---

# 4. Prisma Schema Proposal

> **Proposal only.** Append to `prisma/schema.prisma` in a later migration phase.  
> Shows new enums + models. Relation stubs for `User` / `Employee` listed at end.

```prisma
// =============================================================================
// RECRUITMENT MODULE — SCHEMA PROPOSAL (not yet applied)
// =============================================================================

// --- Enums -------------------------------------------------------------------

enum JobOpeningStatus {
  draft
  open
  on_hold
  closed
  filled
}

enum JobEmploymentType {
  full_time
  part_time
  contract
  intern
  temporary
  other
}

enum HiringTeamRole {
  recruiter
  hiring_manager
  team_lead
  interviewer
}

enum CandidateStatus {
  active
  hired
  talent_pool
  do_not_hire
  archived
}

enum CandidateSource {
  manual_upload
  referral
  csv_import
  google_forms_csv
  other
}

enum RecruitmentDocumentType {
  resume
  cover_letter
  portfolio
  assessment
  offer_letter
  identity
  other
}

enum NoteVisibility {
  team
  private
  hr_only
}

enum IntakeItemStatus {
  received
  parse_pending
  parse_ready
  duplicate_review
  confirmed
  discarded
}

enum ApplicationPriority {
  low
  normal
  high
  critical
}

enum ApplicationStatus {
  active
  hired
  rejected
  on_hold
  withdrawn
}

/// System pipeline stages (PRD defaults). Terminal + hold included.
enum RecruitmentPipelineStage {
  resume_received
  screening
  assessment
  hr_round
  technical_round
  team_lead_round
  manager_round
  client_round
  reference_check
  decision
  offer
  hired
  rejected
  on_hold
  withdrawn
}

enum InterviewStatus {
  draft
  scheduled
  completed
  no_show
  cancelled
}

enum InterviewRoundType {
  screening
  hr
  technical
  team_lead
  manager
  client
  other
}

enum HiringDecisionOutcome {
  strong_hire
  hire
  borderline
  hold
  reject
}

enum OfferStatus {
  draft
  manager_approval
  hr_approval
  released
  accepted
  declined
  withdrawn
}

enum AiInsightType {
  resume_parse
  profile_completion
  quality_score
  candidate_summary
  duplicate_suggestion
  job_match
  interview_summary
  decision_draft
}

enum AiInsightStatus {
  pending_review
  accepted
  dismissed
  superseded
}

enum RecruitmentTimelineEntityType {
  job_opening
  candidate
  application
  interview
  offer
  intake
}

enum SavedFilterEntity {
  applications
  candidates
  jobs
  interviews
  offers
}

// Extend existing NotificationType in real migration:
// recruitment_interview_scheduled
// recruitment_stage_changed
// recruitment_decision_pending
// recruitment_offer_approval
// recruitment_offer_released
// recruitment_duplicate_found
// recruitment_parse_ready
// recruitment_mention
// recruitment_converted
// recruitment_sla_stale

// --- Config ------------------------------------------------------------------

/// Org-level recruitment settings (singleton row id = "default").
model RecruitmentSettings {
  id                        String   @id @default("default")
  defaultPipelineTemplateId String?  @map("default_pipeline_template_id")
  defaultPipelineTemplate   RecruitmentPipelineTemplate? @relation(fields: [defaultPipelineTemplateId], references: [id], onDelete: SetNull)
  slaDaysPerStageJson       Json     @default("{}") @map("sla_days_per_stage_json")
  aiEnabled                 Boolean  @default(true) @map("ai_enabled")
  requireDecisionForOffer   Boolean  @default(true) @map("require_decision_for_offer")
  skipManagerApprovalIfNoHm Boolean  @default(true) @map("skip_manager_approval_if_no_hm")
  hmCompensationVisible     Boolean  @default(true) @map("hm_compensation_visible")
  allowDuplicateActiveApp   Boolean  @default(false) @map("allow_duplicate_active_app")
  metadata                  Json     @default("{}")
  updatedAt                 DateTime @updatedAt @map("updated_at")

  @@map("recruitment_settings")
}

model RecruitmentPipelineTemplate {
  id          String   @id @default(cuid())
  name        String
  description String?
  isSystem    Boolean  @default(false) @map("is_system")
  isActive    Boolean  @default(true) @map("is_active")
  createdByUserId String? @map("created_by_user_id")
  createdBy   User?    @relation("PipelineTemplateCreatedBy", fields: [createdByUserId], references: [id], onDelete: SetNull)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  deletedAt   DateTime? @map("deleted_at")
  stages      PipelineTemplateStage[]
  jobOpenings JobOpening[]
  settingsAsDefault RecruitmentSettings[]

  @@index([isActive, deletedAt])
  @@map("recruitment_pipeline_templates")
}

model PipelineTemplateStage {
  id         String                   @id @default(cuid())
  templateId String                   @map("template_id")
  template   RecruitmentPipelineTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  stage      RecruitmentPipelineStage
  sortOrder  Int                      @map("sort_order")
  isOptional Boolean                  @default(false) @map("is_optional")
  label      String?
  slaDays    Int?                     @map("sla_days")

  @@unique([templateId, stage])
  @@unique([templateId, sortOrder])
  @@index([templateId])
  @@map("recruitment_pipeline_template_stages")
}

// --- Job Opening -------------------------------------------------------------

model JobOpening {
  id                 String           @id @default(cuid())
  title              String
  code               String?          @unique
  status             JobOpeningStatus @default(draft)
  department         String?
  location           String?
  workMode           String?          @map("work_mode") // onsite|hybrid|remote (string for flexibility)
  employmentType     JobEmploymentType @default(full_time) @map("employment_type")
  description        String?
  requirements       String?
  openingsCount      Int              @default(1) @map("openings_count")
  /// Headcount request fields (NOT a separate entity — architecture freeze)
  headcountApproved  Boolean          @default(false) @map("headcount_approved")
  headcountRequestedByEmployeeId Int? @map("headcount_requested_by_employee_id")
  headcountRequestedBy Employee?      @relation("JobHeadcountRequester", fields: [headcountRequestedByEmployeeId], references: [id], onDelete: SetNull)
  headcountRequestedAt DateTime?      @map("headcount_requested_at")
  headcountUrgency   String?          @map("headcount_urgency")
  compensationCurrency String?        @map("compensation_currency")
  compensationMin    Decimal?         @map("compensation_min") @db.Decimal(14, 2)
  compensationMax    Decimal?         @map("compensation_max") @db.Decimal(14, 2)
  targetStartDate    DateTime?        @map("target_start_date")
  pipelineTemplateId String?          @map("pipeline_template_id")
  pipelineTemplate   RecruitmentPipelineTemplate? @relation(fields: [pipelineTemplateId], references: [id], onDelete: SetNull)
  ownerRecruiterUserId String?        @map("owner_recruiter_user_id")
  ownerRecruiter     User?            @relation("JobOpeningOwner", fields: [ownerRecruiterUserId], references: [id], onDelete: SetNull)
  publishedAt        DateTime?        @map("published_at")
  closedAt           DateTime?        @map("closed_at")
  filledAt           DateTime?        @map("filled_at")
  createdByUserId    String?          @map("created_by_user_id")
  createdBy          User?            @relation("JobOpeningCreatedBy", fields: [createdByUserId], references: [id], onDelete: SetNull)
  createdAt          DateTime         @default(now()) @map("created_at")
  updatedAt          DateTime         @updatedAt @map("updated_at")
  deletedAt          DateTime?        @map("deleted_at")

  stages       JobOpeningStage[]
  hiringTeam   HiringTeamMember[]
  documents    JobOpeningDocument[]
  notes        JobOpeningNote[]
  applications Application[]
  intakeItems  IntakeItem[]

  @@index([status, deletedAt])
  @@index([department])
  @@index([ownerRecruiterUserId, status])
  @@index([createdAt])
  @@index([deletedAt])
  @@map("job_openings")
}

/// Frozen ordered stages for this job (copied from template at create).
model JobOpeningStage {
  id           String                   @id @default(cuid())
  jobOpeningId String                   @map("job_opening_id")
  jobOpening   JobOpening               @relation(fields: [jobOpeningId], references: [id], onDelete: Cascade)
  stage        RecruitmentPipelineStage
  sortOrder    Int                      @map("sort_order")
  isOptional   Boolean                  @default(false) @map("is_optional")
  isEnabled    Boolean                  @default(true) @map("is_enabled")
  label        String?
  slaDays      Int?                     @map("sla_days")

  @@unique([jobOpeningId, stage])
  @@unique([jobOpeningId, sortOrder])
  @@index([jobOpeningId])
  @@map("job_opening_stages")
}

model HiringTeamMember {
  id           String         @id @default(cuid())
  jobOpeningId String         @map("job_opening_id")
  jobOpening   JobOpening     @relation(fields: [jobOpeningId], references: [id], onDelete: Cascade)
  employeeId   Int            @map("employee_id")
  employee     Employee       @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  role         HiringTeamRole
  createdAt    DateTime       @default(now()) @map("created_at")

  @@unique([jobOpeningId, employeeId, role])
  @@index([employeeId, role])
  @@index([jobOpeningId, role])
  /// ScopeEngine: resolve job ids for an employee quickly
  @@index([employeeId, jobOpeningId])
  @@map("hiring_team_members")
}

model JobOpeningDocument {
  id           String                  @id @default(cuid())
  jobOpeningId String                  @map("job_opening_id")
  jobOpening   JobOpening              @relation(fields: [jobOpeningId], references: [id], onDelete: Cascade)
  documentType RecruitmentDocumentType @default(other) @map("document_type")
  fileName     String                  @map("file_name")
  mimeType     String?                 @map("mime_type")
  sizeBytes    Int?                    @map("size_bytes")
  storageKey   String                  @map("storage_key")
  checksum     String?
  uploadedByUserId String?             @map("uploaded_by_user_id")
  uploadedBy   User?                   @relation("JobDocUploadedBy", fields: [uploadedByUserId], references: [id], onDelete: SetNull)
  createdAt    DateTime                @default(now()) @map("created_at")
  deletedAt    DateTime?               @map("deleted_at")

  @@index([jobOpeningId, deletedAt])
  @@map("job_opening_documents")
}

model JobOpeningNote {
  id           String         @id @default(cuid())
  jobOpeningId String         @map("job_opening_id")
  jobOpening   JobOpening     @relation(fields: [jobOpeningId], references: [id], onDelete: Cascade)
  body         String
  visibility   NoteVisibility @default(team)
  isPinned     Boolean        @default(false) @map("is_pinned")
  isResolved   Boolean        @default(false) @map("is_resolved")
  authorUserId String         @map("author_user_id")
  author       User           @relation("JobNoteAuthor", fields: [authorUserId], references: [id], onDelete: Cascade)
  createdAt    DateTime       @default(now()) @map("created_at")
  updatedAt    DateTime       @updatedAt @map("updated_at")
  deletedAt    DateTime?      @map("deleted_at")

  @@index([jobOpeningId, deletedAt])
  @@index([jobOpeningId, isPinned])
  @@map("job_opening_notes")
}

// --- Candidate ---------------------------------------------------------------

model Candidate {
  id              String          @id @default(cuid())
  fullName        String          @map("full_name")
  preferredName   String?         @map("preferred_name")
  email           String?
  phone           String?
  alternatePhone  String?         @map("alternate_phone")
  location        String?
  currentCompany  String?         @map("current_company")
  currentTitle    String?         @map("current_title")
  linkedinUrl     String?         @map("linkedin_url")
  source          CandidateSource @default(manual_upload)
  status          CandidateStatus @default(active)
  doNotHireReason String?         @map("do_not_hire_reason")
  /// Compensation expectations (sensitive — Scope/Permission gated in queries)
  currentCtc      Decimal?        @map("current_ctc") @db.Decimal(14, 2)
  expectedCtc     Decimal?        @map("expected_ctc") @db.Decimal(14, 2)
  currency        String?         @default("INR")
  noticePeriodDays Int?           @map("notice_period_days")
  earliestJoinDate DateTime?      @map("earliest_join_date")
  availabilityNotes String?       @map("availability_notes")
  timezone        String?
  primaryRecruiterUserId String?  @map("primary_recruiter_user_id")
  primaryRecruiter User?          @relation("CandidatePrimaryRecruiter", fields: [primaryRecruiterUserId], references: [id], onDelete: SetNull)
  referredByEmployeeId Int?       @map("referred_by_employee_id")
  referredBy      Employee?       @relation("CandidateReferrer", fields: [referredByEmployeeId], references: [id], onDelete: SetNull)
  /// Set on successful conversion
  employeeId      Int?            @unique @map("employee_id")
  employee        Employee?       @relation("CandidateConvertedEmployee", fields: [employeeId], references: [id], onDelete: SetNull)
  mergedIntoCandidateId String?   @map("merged_into_candidate_id")
  mergedInto      Candidate?      @relation("CandidateMerge", fields: [mergedIntoCandidateId], references: [id], onDelete: SetNull)
  mergedFrom      Candidate[]     @relation("CandidateMerge")
  createdByUserId String?         @map("created_by_user_id")
  createdBy       User?           @relation("CandidateCreatedBy", fields: [createdByUserId], references: [id], onDelete: SetNull)
  createdAt       DateTime        @default(now()) @map("created_at")
  updatedAt       DateTime        @updatedAt @map("updated_at")
  deletedAt       DateTime?       @map("deleted_at")

  documents       CandidateDocument[]
  experiences     CandidateExperience[]
  educations      CandidateEducation[]
  skills          CandidateSkill[]
  projects        CandidateProject[]
  certifications  CandidateCertification[]
  notes           CandidateNote[]
  chatMessages    CandidateChatMessage[]
  tags            CandidateTag[]
  talentPoolEntries TalentPoolEntry[]
  aiInsights      CandidateAiInsight[]
  applications    Application[]
  intakeItems     IntakeItem[]
  conversionSnapshot EmployeeConversionSnapshot?

  @@index([status, deletedAt])
  @@index([email])
  @@index([phone])
  @@index([source])
  @@index([primaryRecruiterUserId])
  @@index([createdAt])
  @@index([fullName])
  @@index([deletedAt])
  /// Partial unique (email) among live candidates — enforce in migration SQL:
  /// CREATE UNIQUE INDEX ... ON candidates (lower(email)) WHERE deleted_at IS NULL AND email IS NOT NULL AND merged_into_candidate_id IS NULL;
  @@map("candidates")
}

model CandidateDocument {
  id           String                  @id @default(cuid())
  candidateId  String                  @map("candidate_id")
  candidate    Candidate               @relation(fields: [candidateId], references: [id], onDelete: Cascade)
  documentType RecruitmentDocumentType @map("document_type")
  fileName     String                  @map("file_name")
  mimeType     String?                 @map("mime_type")
  sizeBytes    Int?                    @map("size_bytes")
  storageKey   String                  @map("storage_key")
  checksum     String?
  version      Int                     @default(1)
  isPrimary    Boolean                 @default(false) @map("is_primary")
  uploadedByUserId String?             @map("uploaded_by_user_id")
  uploadedBy   User?                   @relation("CandidateDocUploadedBy", fields: [uploadedByUserId], references: [id], onDelete: SetNull)
  createdAt    DateTime                @default(now()) @map("created_at")
  deletedAt    DateTime?               @map("deleted_at")

  @@index([candidateId, documentType, deletedAt])
  @@index([candidateId, isPrimary])
  @@map("candidate_documents")
}

model CandidateExperience {
  id          String    @id @default(cuid())
  candidateId String    @map("candidate_id")
  candidate   Candidate @relation(fields: [candidateId], references: [id], onDelete: Cascade)
  company     String
  title       String
  location    String?
  startDate   DateTime? @map("start_date")
  endDate     DateTime? @map("end_date")
  isCurrent   Boolean   @default(false) @map("is_current")
  description String?
  sortOrder   Int       @default(0) @map("sort_order")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  @@index([candidateId, sortOrder])
  @@map("candidate_experiences")
}

model CandidateEducation {
  id          String    @id @default(cuid())
  candidateId String    @map("candidate_id")
  candidate   Candidate @relation(fields: [candidateId], references: [id], onDelete: Cascade)
  institution String
  degree      String?
  field       String?
  startYear   Int?      @map("start_year")
  endYear     Int?      @map("end_year")
  notes       String?
  sortOrder   Int       @default(0) @map("sort_order")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  @@index([candidateId])
  @@map("candidate_educations")
}

model CandidateSkill {
  id           String    @id @default(cuid())
  candidateId  String    @map("candidate_id")
  candidate    Candidate @relation(fields: [candidateId], references: [id], onDelete: Cascade)
  name         String
  proficiency  String?
  isConfirmed  Boolean   @default(true) @map("is_confirmed")
  createdAt    DateTime  @default(now()) @map("created_at")

  @@unique([candidateId, name])
  @@index([name])
  @@map("candidate_skills")
}

model CandidateProject {
  id          String    @id @default(cuid())
  candidateId String    @map("candidate_id")
  candidate   Candidate @relation(fields: [candidateId], references: [id], onDelete: Cascade)
  title       String
  summary     String?
  techStack   String?   @map("tech_stack")
  url         String?
  sortOrder   Int       @default(0) @map("sort_order")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  @@index([candidateId])
  @@map("candidate_projects")
}

model CandidateCertification {
  id           String    @id @default(cuid())
  candidateId  String    @map("candidate_id")
  candidate    Candidate @relation(fields: [candidateId], references: [id], onDelete: Cascade)
  name         String
  issuer       String?
  issuedAt     DateTime? @map("issued_at")
  expiresAt    DateTime? @map("expires_at")
  credentialId String?   @map("credential_id")
  createdAt    DateTime  @default(now()) @map("created_at")

  @@index([candidateId])
  @@map("candidate_certifications")
}

model CandidateNote {
  id           String         @id @default(cuid())
  candidateId  String         @map("candidate_id")
  candidate    Candidate      @relation(fields: [candidateId], references: [id], onDelete: Cascade)
  body         String
  visibility   NoteVisibility @default(team)
  isPinned     Boolean        @default(false) @map("is_pinned")
  isResolved   Boolean        @default(false) @map("is_resolved")
  authorUserId String         @map("author_user_id")
  author       User           @relation("CandidateNoteAuthor", fields: [authorUserId], references: [id], onDelete: Cascade)
  createdAt    DateTime       @default(now()) @map("created_at")
  updatedAt    DateTime       @updatedAt @map("updated_at")
  deletedAt    DateTime?      @map("deleted_at")

  @@index([candidateId, deletedAt])
  @@index([candidateId, isPinned])
  @@map("candidate_notes")
}

model CandidateChatMessage {
  id           String    @id @default(cuid())
  candidateId  String    @map("candidate_id")
  candidate    Candidate @relation(fields: [candidateId], references: [id], onDelete: Cascade)
  body         String
  authorUserId String    @map("author_user_id")
  author       User      @relation("CandidateChatAuthor", fields: [authorUserId], references: [id], onDelete: Cascade)
  isPinned     Boolean   @default(false) @map("is_pinned")
  promotedNoteId String? @map("promoted_note_id")
  createdAt    DateTime  @default(now()) @map("created_at")
  deletedAt    DateTime? @map("deleted_at")

  @@index([candidateId, createdAt])
  @@index([candidateId, deletedAt])
  @@map("candidate_chat_messages")
}

model RecruitmentTag {
  id        String   @id @default(cuid())
  name      String   @unique
  color     String?
  createdAt DateTime @default(now()) @map("created_at")
  candidates CandidateTag[]

  @@map("recruitment_tags")
}

model CandidateTag {
  candidateId String    @map("candidate_id")
  tagId       String    @map("tag_id")
  candidate   Candidate @relation(fields: [candidateId], references: [id], onDelete: Cascade)
  tag         RecruitmentTag @relation(fields: [tagId], references: [id], onDelete: Cascade)
  createdAt   DateTime  @default(now()) @map("created_at")

  @@id([candidateId, tagId])
  @@index([tagId])
  @@map("candidate_tags")
}

model TalentPoolEntry {
  id              String    @id @default(cuid())
  candidateId     String    @map("candidate_id")
  candidate       Candidate @relation(fields: [candidateId], references: [id], onDelete: Cascade)
  reason          String?
  sourceApplicationId String? @map("source_application_id")
  enteredAt       DateTime  @default(now()) @map("entered_at")
  exitedAt        DateTime? @map("exited_at")
  createdByUserId String?   @map("created_by_user_id")

  @@index([candidateId, exitedAt])
  @@index([enteredAt])
  @@map("talent_pool_entries")
}

model CandidateAiInsight {
  id           String          @id @default(cuid())
  candidateId  String          @map("candidate_id")
  candidate    Candidate       @relation(fields: [candidateId], references: [id], onDelete: Cascade)
  applicationId String?        @map("application_id")
  insightType  AiInsightType   @map("insight_type")
  status       AiInsightStatus @default(pending_review)
  title        String?
  contentJson  Json            @map("content_json")
  confidence   Float?
  modelId      String?         @map("model_id")
  createdByUserId String?      @map("created_by_user_id")
  reviewedByUserId String?     @map("reviewed_by_user_id")
  reviewedAt   DateTime?       @map("reviewed_at")
  createdAt    DateTime        @default(now()) @map("created_at")

  @@index([candidateId, status])
  @@index([insightType, status])
  @@index([createdAt])
  @@map("candidate_ai_insights")
}

model IntakeItem {
  id              String           @id @default(cuid())
  status          IntakeItemStatus @default(received)
  source          CandidateSource
  rawPayloadJson  Json             @default("{}") @map("raw_payload_json")
  fileName        String?          @map("file_name")
  storageKey      String?          @map("storage_key")
  candidateId     String?          @map("candidate_id")
  candidate       Candidate?       @relation(fields: [candidateId], references: [id], onDelete: SetNull)
  jobOpeningId    String?          @map("job_opening_id")
  jobOpening      JobOpening?      @relation(fields: [jobOpeningId], references: [id], onDelete: SetNull)
  duplicateOfCandidateId String?   @map("duplicate_of_candidate_id")
  duplicateConfidence Float?       @map("duplicate_confidence")
  errorMessage    String?          @map("error_message")
  createdByUserId String?          @map("created_by_user_id")
  createdBy       User?            @relation("IntakeCreatedBy", fields: [createdByUserId], references: [id], onDelete: SetNull)
  createdAt       DateTime         @default(now()) @map("created_at")
  updatedAt       DateTime         @updatedAt @map("updated_at")

  @@index([status, createdAt])
  @@index([jobOpeningId])
  @@index([candidateId])
  @@map("recruitment_intake_items")
}

// --- Application & pipeline --------------------------------------------------

model Application {
  id                    String                   @id @default(cuid())
  candidateId           String                   @map("candidate_id")
  candidate             Candidate                @relation(fields: [candidateId], references: [id], onDelete: Restrict)
  jobOpeningId          String                   @map("job_opening_id")
  jobOpening            JobOpening               @relation(fields: [jobOpeningId], references: [id], onDelete: Restrict)
  status                ApplicationStatus        @default(active)
  currentStage          RecruitmentPipelineStage @default(resume_received) @map("current_stage")
  stageEnteredAt        DateTime                 @default(now()) @map("stage_entered_at")
  priority              ApplicationPriority      @default(normal)
  assignedRecruiterUserId String?                @map("assigned_recruiter_user_id")
  assignedRecruiter     User?                    @relation("ApplicationRecruiter", fields: [assignedRecruiterUserId], references: [id], onDelete: SetNull)
  assignedManagerEmployeeId Int?                 @map("assigned_manager_employee_id")
  assignedManager       Employee?                @relation("ApplicationManager", fields: [assignedManagerEmployeeId], references: [id], onDelete: SetNull)
  source                CandidateSource?
  riskFlagsJson         Json                     @default("[]") @map("risk_flags_json")
  aggregateScore        Float?                   @map("aggregate_score")
  rejectedReason        String?                  @map("rejected_reason")
  holdReason            String?                  @map("hold_reason")
  withdrawnReason       String?                  @map("withdrawn_reason")
  createdByUserId       String?                  @map("created_by_user_id")
  createdBy             User?                    @relation("ApplicationCreatedBy", fields: [createdByUserId], references: [id], onDelete: SetNull)
  createdAt             DateTime                 @default(now()) @map("created_at")
  updatedAt             DateTime                 @updatedAt @map("updated_at")
  deletedAt             DateTime?                @map("deleted_at")

  stageHistory   ApplicationStageHistory[]
  interviews     Interview[]
  decisions      HiringDecision[]
  offers         Offer[]
  conversionSnapshot EmployeeConversionSnapshot?

  @@index([jobOpeningId, currentStage, deletedAt])
  @@index([candidateId, deletedAt])
  @@index([status, currentStage])
  @@index([assignedRecruiterUserId, status])
  @@index([assignedManagerEmployeeId, status])
  @@index([priority, currentStage])
  @@index([stageEnteredAt])
  @@index([createdAt])
  /// Partial unique active app per candidate×job — migration SQL:
  /// UNIQUE (candidate_id, job_opening_id) WHERE deleted_at IS NULL AND status = 'active'
  @@index([candidateId, jobOpeningId])
  @@map("recruitment_applications")
}

model ApplicationStageHistory {
  id            String                   @id @default(cuid())
  applicationId String                   @map("application_id")
  application   Application              @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  fromStage     RecruitmentPipelineStage? @map("from_stage")
  toStage       RecruitmentPipelineStage @map("to_stage")
  note          String?
  isOverride    Boolean                  @default(false) @map("is_override")
  actorUserId   String?                  @map("actor_user_id")
  actor         User?                    @relation("StageHistoryActor", fields: [actorUserId], references: [id], onDelete: SetNull)
  createdAt     DateTime                 @default(now()) @map("created_at")

  @@index([applicationId, createdAt])
  @@index([toStage, createdAt])
  @@map("application_stage_history")
}

// --- Interview ---------------------------------------------------------------

model Interview {
  id            String             @id @default(cuid())
  applicationId String             @map("application_id")
  application   Application        @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  roundType     InterviewRoundType @map("round_type")
  status        InterviewStatus    @default(draft)
  title         String?
  scheduledStart DateTime?         @map("scheduled_start")
  scheduledEnd   DateTime?         @map("scheduled_end")
  timezone      String?
  location      String?
  meetingUrl    String?            @map("meeting_url")
  transcriptText String?           @map("transcript_text")
  recordingUrl  String?            @map("recording_url")
  summary       String?
  createdByUserId String?          @map("created_by_user_id")
  createdBy     User?              @relation("InterviewCreatedBy", fields: [createdByUserId], references: [id], onDelete: SetNull)
  createdAt     DateTime           @default(now()) @map("created_at")
  updatedAt     DateTime           @updatedAt @map("updated_at")
  deletedAt     DateTime?          @map("deleted_at")

  panelists   InterviewPanelist[]
  feedback    InterviewFeedback[]
  attachments InterviewAttachment[]

  @@index([applicationId, status])
  @@index([scheduledStart])
  @@index([status, scheduledStart])
  @@map("recruitment_interviews")
}

model InterviewPanelist {
  id           String    @id @default(cuid())
  interviewId  String    @map("interview_id")
  interview    Interview @relation(fields: [interviewId], references: [id], onDelete: Cascade)
  employeeId   Int       @map("employee_id")
  employee     Employee  @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  isObserver   Boolean   @default(false) @map("is_observer")
  createdAt    DateTime  @default(now()) @map("created_at")

  @@unique([interviewId, employeeId])
  @@index([employeeId])
  @@map("interview_panelists")
}

model InterviewFeedback {
  id            String    @id @default(cuid())
  interviewId   String    @map("interview_id")
  interview     Interview @relation(fields: [interviewId], references: [id], onDelete: Cascade)
  authorEmployeeId Int    @map("author_employee_id")
  author        Employee  @relation(fields: [authorEmployeeId], references: [id], onDelete: Cascade)
  overallRating Float?    @map("overall_rating")
  ratingsJson   Json      @default("{}") @map("ratings_json")
  recommendation String?
  strengths     String?
  concerns      String?
  privateNotes  String?   @map("private_notes")
  submittedAt   DateTime? @map("submitted_at")
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  @@unique([interviewId, authorEmployeeId])
  @@index([authorEmployeeId])
  @@map("interview_feedback")
}

model InterviewAttachment {
  id          String    @id @default(cuid())
  interviewId String    @map("interview_id")
  interview   Interview @relation(fields: [interviewId], references: [id], onDelete: Cascade)
  fileName    String    @map("file_name")
  mimeType    String?   @map("mime_type")
  sizeBytes   Int?      @map("size_bytes")
  storageKey  String    @map("storage_key")
  uploadedByUserId String? @map("uploaded_by_user_id")
  createdAt   DateTime  @default(now()) @map("created_at")
  deletedAt   DateTime? @map("deleted_at")

  @@index([interviewId])
  @@map("interview_attachments")
}

// --- Decision / Offer / Conversion -------------------------------------------

model HiringDecision {
  id            String                @id @default(cuid())
  applicationId String                @map("application_id")
  application   Application           @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  outcome       HiringDecisionOutcome
  rationale     String
  strengths     String
  concerns      String?
  salaryRecommendation Decimal?       @map("salary_recommendation") @db.Decimal(14, 2)
  currency      String?
  riskTagsJson  Json                  @default("[]") @map("risk_tags_json")
  version       Int
  isCurrent     Boolean               @default(true) @map("is_current")
  decidedByUserId String              @map("decided_by_user_id")
  decidedBy     User                  @relation("DecisionAuthor", fields: [decidedByUserId], references: [id], onDelete: Restrict)
  decidedAt     DateTime              @default(now()) @map("decided_at")
  createdAt     DateTime              @default(now()) @map("created_at")

  offers Offer[]

  @@unique([applicationId, version])
  @@index([applicationId, isCurrent])
  @@index([outcome, decidedAt])
  @@map("hiring_decisions")
}

model Offer {
  id               String      @id @default(cuid())
  applicationId    String      @map("application_id")
  application      Application @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  hiringDecisionId String      @map("hiring_decision_id")
  hiringDecision   HiringDecision @relation(fields: [hiringDecisionId], references: [id], onDelete: Restrict)
  status           OfferStatus @default(draft)
  currency         String      @default("INR")
  baseSalary       Decimal     @map("base_salary") @db.Decimal(14, 2)
  variablePay      Decimal?    @map("variable_pay") @db.Decimal(14, 2)
  benefitsNotes    String?     @map("benefits_notes")
  proposedStartDate DateTime?  @map("proposed_start_date")
  expiresAt        DateTime?   @map("expires_at")
  managerApprovalSkipped Boolean @default(false) @map("manager_approval_skipped")
  managerApprovedByUserId String? @map("manager_approved_by_user_id")
  managerApprovedAt DateTime?  @map("manager_approved_at")
  hrApprovedByUserId String?   @map("hr_approved_by_user_id")
  hrApprovedAt     DateTime?   @map("hr_approved_at")
  releasedAt       DateTime?   @map("released_at")
  acceptedAt       DateTime?   @map("accepted_at")
  declinedAt       DateTime?   @map("declined_at")
  withdrawnAt      DateTime?   @map("withdrawn_at")
  createdByUserId  String?     @map("created_by_user_id")
  createdBy        User?       @relation("OfferCreatedBy", fields: [createdByUserId], references: [id], onDelete: SetNull)
  createdAt        DateTime    @default(now()) @map("created_at")
  updatedAt        DateTime    @updatedAt @map("updated_at")

  revisions OfferRevision[]
  conversionSnapshot EmployeeConversionSnapshot?

  @@index([applicationId, status])
  @@index([status, createdAt])
  @@index([hiringDecisionId])
  @@map("recruitment_offers")
}

model OfferRevision {
  id        String   @id @default(cuid())
  offerId   String   @map("offer_id")
  offer     Offer    @relation(fields: [offerId], references: [id], onDelete: Cascade)
  version   Int
  snapshotJson Json  @map("snapshot_json")
  changeNote String? @map("change_note")
  actorUserId String? @map("actor_user_id")
  createdAt DateTime @default(now()) @map("created_at")

  @@unique([offerId, version])
  @@index([offerId])
  @@map("offer_revisions")
}

/// IMMUTABLE — no updatedAt, no deletedAt, no product updates.
model EmployeeConversionSnapshot {
  id              String   @id @default(cuid())
  applicationId   String   @unique @map("application_id")
  application     Application @relation(fields: [applicationId], references: [id], onDelete: Restrict)
  candidateId     String   @unique @map("candidate_id")
  candidate       Candidate @relation(fields: [candidateId], references: [id], onDelete: Restrict)
  offerId         String   @unique @map("offer_id")
  offer           Offer    @relation(fields: [offerId], references: [id], onDelete: Restrict)
  employeeId      Int      @unique @map("employee_id")
  employee        Employee @relation("ConversionSnapshotEmployee", fields: [employeeId], references: [id], onDelete: Restrict)
  fieldMapVersion String   @map("field_map_version")
  mappedFields    Json     @map("mapped_fields")
  overrideReason  String?  @map("override_reason")
  convertedByUserId String @map("converted_by_user_id")
  convertedBy     User     @relation("ConversionActor", fields: [convertedByUserId], references: [id], onDelete: Restrict)
  convertedAt     DateTime @default(now()) @map("converted_at")
  /// createdAt == convertedAt semantically; keep for audit-field consistency
  createdAt       DateTime @default(now()) @map("created_at")

  @@index([convertedAt])
  @@map("employee_conversion_snapshots")
}

// --- Timeline / metrics / saved filters --------------------------------------

model RecruitmentTimelineEvent {
  id         String                       @id @default(cuid())
  entityType RecruitmentTimelineEntityType @map("entity_type")
  entityId   String                       @map("entity_id")
  applicationId String?                   @map("application_id")
  candidateId   String?                   @map("candidate_id")
  jobOpeningId  String?                   @map("job_opening_id")
  eventType  String                       @map("event_type")
  summary    String
  actorUserId String?                     @map("actor_user_id")
  metadata   Json                         @default("{}")
  createdAt  DateTime                     @default(now()) @map("created_at")

  @@index([entityType, entityId, createdAt])
  @@index([applicationId, createdAt])
  @@index([candidateId, createdAt])
  @@index([jobOpeningId, createdAt])
  @@index([eventType, createdAt])
  @@map("recruitment_timeline_events")
}

/// Dashboard / report aggregates (WorkforceMetric pattern).
model RecruitmentMetricSnapshot {
  id          String   @id @default(cuid())
  metricKey   String   @map("metric_key")
  scopeType   String   @map("scope_type") // org|job|recruiter|manager
  scopeKey    String   @map("scope_key")
  periodStart DateTime @map("period_start")
  periodEnd   DateTime @map("period_end")
  value       Float
  payloadJson Json     @default("{}") @map("payload_json")
  computedAt  DateTime @default(now()) @map("computed_at")

  @@unique([metricKey, scopeType, scopeKey, periodStart, periodEnd])
  @@index([metricKey, periodStart])
  @@index([scopeType, scopeKey])
  @@map("recruitment_metric_snapshots")
}

model RecruitmentSavedFilter {
  id         String            @id @default(cuid())
  userId     String            @map("user_id")
  user       User              @relation("RecruitmentSavedFilters", fields: [userId], references: [id], onDelete: Cascade)
  entity     SavedFilterEntity
  name       String
  filterJson Json              @map("filter_json")
  isDefault  Boolean           @default(false) @map("is_default")
  createdAt  DateTime          @default(now()) @map("created_at")
  updatedAt  DateTime          @updatedAt @map("updated_at")

  @@unique([userId, entity, name])
  @@index([userId, entity])
  @@map("recruitment_saved_filters")
}
```

### Required stubs on existing models (additive only)

```prisma
// On User — add relations only (illustrative names):
// pipelineTemplatesCreated, jobOpeningsOwned, jobOpeningsCreated,
// jobDocsUploaded, jobNotesAuthored, candidatesPrimary, candidatesCreated,
// candidateDocsUploaded, candidateNotesAuthored, candidateChatsAuthored,
// intakeCreated, applicationsAsRecruiter, applicationsCreated,
// stageHistoryActed, interviewsCreated, decisionsAuthored, offersCreated,
// conversionsActed, savedRecruitmentFilters

// On Employee — add relations only:
// hiringTeamMemberships, headcountRequestedJobs, candidatesReferred,
// convertedFromCandidate, applicationsAsManager, interviewPanelistOf,
// interviewFeedbackAuthored, conversionSnapshots
```

---

# 5. Enum Proposal

| Enum | Values (summary) | Notes |
|------|------------------|-------|
| `JobOpeningStatus` | draft, open, on_hold, closed, filled | |
| `JobEmploymentType` | full_time, part_time, contract, intern, temporary, other | |
| `HiringTeamRole` | recruiter, hiring_manager, team_lead, interviewer | ScopeEngine input |
| `CandidateStatus` | active, hired, talent_pool, do_not_hire, archived | |
| `CandidateSource` | manual_upload, referral, csv_import, google_forms_csv, other | V1 CSV forms |
| `RecruitmentDocumentType` | resume, cover_letter, portfolio, assessment, offer_letter, identity, other | |
| `NoteVisibility` | team, private, hr_only | |
| `IntakeItemStatus` | received, parse_pending, parse_ready, duplicate_review, confirmed, discarded | |
| `ApplicationPriority` | low, normal, high, critical | |
| `ApplicationStatus` | active, hired, rejected, on_hold, withdrawn | Parallel to terminal stages |
| `RecruitmentPipelineStage` | full PRD set including rejected/on_hold/withdrawn | Single stage enum |
| `InterviewStatus` | draft, scheduled, completed, no_show, cancelled | |
| `InterviewRoundType` | screening, hr, technical, team_lead, manager, client, other | |
| `HiringDecisionOutcome` | strong_hire, hire, borderline, hold, reject | |
| `OfferStatus` | draft, manager_approval, hr_approval, released, accepted, declined, withdrawn | Skip HM in workflow |
| `AiInsightType` / `AiInsightStatus` | parse, scores, drafts… / pending, accepted, dismissed, superseded | |
| `RecruitmentTimelineEntityType` | job_opening, candidate, application, interview, offer, intake | |
| `SavedFilterEntity` | applications, candidates, jobs, interviews, offers | |
| **Extend** `NotificationType` | recruitment_* values listed in schema comments | Do not fork Notification model |

---

# 6. Index Proposal

### Critical for ScopeEngine + lists (100k candidates / 50k apps)

| Table | Index | Purpose |
|-------|-------|---------|
| `hiring_team_members` | `(employee_id, job_opening_id)`, `(employee_id, role)` | Resolve scoped job IDs |
| `interview_panelists` | `(employee_id)` | TL/interviewer scope |
| `recruitment_applications` | `(job_opening_id, current_stage, deleted_at)` | Pipeline board |
| `recruitment_applications` | `(assigned_recruiter_user_id, status)`, `(assigned_manager_employee_id, status)` | Queues |
| `recruitment_applications` | `(candidate_id, job_opening_id)` + **partial unique** active | Dedupe active apps |
| `candidates` | `(status, deleted_at)`, `(email)`, `(phone)`, `(full_name)` | Search + pool |
| `candidates` | **partial unique** `lower(email)` live | Identity integrity |
| `application_stage_history` | `(application_id, created_at)` | History + time-in-stage |
| `recruitment_interviews` | `(status, scheduled_start)` | Today’s interviews |
| `recruitment_offers` | `(status, created_at)` | Offer queues |
| `recruitment_timeline_events` | `(entity_type, entity_id, created_at)`, `(candidate_id, created_at)` | Timeline UX |
| `candidate_ai_insights` | `(status)`, `(candidate_id, status)` | AI queue |
| `recruitment_metric_snapshots` | unique metric grain | Dashboard/reports |
| `employee_conversion_snapshots` | unique application/candidate/offer/employee | Idempotent conversion |

### Partial indexes (raw SQL in migration)

Prisma cannot express all partial uniques cleanly—add in migration:

1. Live candidate email uniqueness.  
2. One active application per candidate×job.  
3. At most one `hiring_manager` per job (unique where `role = hiring_manager`).  
4. At most one current `HiringDecision` per application (`is_current = true`).  
5. At most one primary resume per candidate (`document_type = resume AND is_primary AND deleted_at IS NULL`).

---

# 7. Performance Recommendations

1. **Never load full candidate profile on list pages** — list DTOs: id, name, email, status, openAppCount.  
2. **Pipeline board:** query `Application` by `jobOpeningId` with `currentStage` only; avoid joining all interviews.  
3. **ScopeEngine:** resolve `jobOpeningIds` once per request (`cache()`), then `WHERE job_opening_id IN (...)`.  
4. **Compensation:** select omit unless authorized; never include in list SELECT *.  
5. **Timeline:** paginate; cap dashboard activity feed (e.g. 50).  
6. **Metrics:** prefer `RecruitmentMetricSnapshot` for funnel/velocity widgets; refresh via worker/event consumer.  
7. **Documents:** store blobs outside Postgres; DB holds keys/metadata only.  
8. **Chat:** keyset pagination on `(candidate_id, created_at)`.  
9. **Trigram (future):** `pg_trgm` on `candidates.full_name` when ILIKE search slows.  
10. **Archive strategy:** soft-deleted candidates excluded by default indexes including `deleted_at`.

---

# 8. Future Migration Considerations

| Topic | Guidance |
|-------|----------|
| Apply order | Enums → settings/templates → jobs/candidates → applications → interviews/decisions/offers → snapshot → timeline/metrics |
| NotificationType | Additive enum values only (Postgres enum alter) |
| User/Employee | Additive relation fields; no breaking column changes |
| Partial indexes | Separate SQL migration step after Prisma migrate |
| V1.5 Google Forms | Extend `CandidateSource` / intake payload; no structural break |
| V2 semantic search | External index; optional `embedding` later—do not block V1 |
| E-sign V3 | Offer gains provider refs; revisions already support package history |
| Backfill metrics | Worker from stage history once data exists |
| Immutability enforcement | DB: no UPDATE grants on `employee_conversion_snapshots` for app role (optional ops hardening) |

---

# 9. Risks

| Risk | Mitigation |
|------|------------|
| Partial uniques forgotten in migration | Checklist in §6; fail CI if missing |
| Dual status (`ApplicationStatus` vs stage) drift | PipelineEngine updates both atomically |
| Offer→Decision Restrict blocks decision delete | Decisions are append-only; never delete current rows used by offers |
| Candidate Restrict on Application delete | Soft-delete applications; hard delete rare/admin only |
| HM as Employee without User | Panelist/feedback use Employee; actions use User session—ScopeEngine maps Employee↔User |
| Compensation in Json snapshots leaked via timeline metadata | Timeline consumer must scrub comp fields |
| Large `content_json` on AI insights | Cap size; store bulky parse trees in object storage if needed |
| JobOpeningStage vs enum drift | Template copy at job create; app validates moves against enabled stages |
| Missing File platform model | Document storageKey convention must match future platform storage ADR |

---

# 10. Architecture Review

### Conforms to approved architecture

| Requirement | Schema support |
|-------------|----------------|
| Headcount on JobOpening | Fields on `JobOpening` — no HeadcountRequest table |
| Application owns stage/interview/decision/offer | FKs + history/children under Application |
| Candidate owns profile/docs/notes | Child tables cascade from Candidate |
| JobOpening owns hiring team | `HiringTeamMember` |
| EmployeeConversionSnapshot immutable | No `updatedAt`/`deletedAt`; unique links; Restrict FKs |
| No interview without application | `Interview.applicationId` required, Cascade |
| No offer without decision | `Offer.hiringDecisionId` required, Restrict |
| Conversion after accepted offer | Enforced in service; snapshot requires `offerId` |
| ScopeEngine | Indexes on hiring team, panelists, assignments |
| Domain events → timeline/metrics | `RecruitmentTimelineEvent`, `RecruitmentMetricSnapshot` |
| No duplicate User/Employee/Audit/Notification | Relations only; AuditLog/Notification reused |
| `/admin/recruitment` only | N/A to schema |
| 100k candidates | cuid PKs, list indexes, metrics snapshots, soft delete, partial uniques |

### Soft delete / cascade summary

| Class | Strategy |
|-------|----------|
| JobOpening, Candidate, Application, Notes, Docs, Chat, Interview | `deletedAt` soft delete |
| HiringTeamMember, template stages, tags join | Hard delete / cascade with parent |
| StageHistory, HiringDecision, OfferRevision, Timeline, Snapshot | **Immutable** — no soft delete |
| Application → Candidate/JobOpening | `onDelete: Restrict` (preserve history) |
| Interview/Decision/Offer → Application | `onDelete: Cascade` (app is aggregate) |
| Snapshot → Employee/Application/Offer | `onDelete: Restrict` |
| Offer → HiringDecision | `onDelete: Restrict` |

### Audit fields convention

- Mutable entities: `createdAt`, `updatedAt`, optional `createdByUserId`, `deletedAt`.  
- Append-only: `createdAt` (+ actor) only.  
- Snapshot: `createdAt` / `convertedAt` only.  
- Platform compliance audit remains `AuditLog` (unchanged), fed by event consumers—not duplicated into these tables.

### Final gate

This schema is ready for a **Prisma migrate design review** and then migration authoring. It does not alter PRD/architecture documents and does not implement application code.

**Next phase after approval:** author migration(s) + partial unique SQL + `NotificationType` extension + User/Employee relation stubs in `schema.prisma`.
