-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "JobOpeningStatus" AS ENUM ('draft', 'open', 'on_hold', 'closed', 'filled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "JobEmploymentType" AS ENUM ('full_time', 'part_time', 'contract', 'intern', 'temporary', 'other');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "HiringTeamRole" AS ENUM ('recruiter', 'hiring_manager', 'team_lead', 'interviewer');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "CandidateStatus" AS ENUM ('active', 'hired', 'talent_pool', 'do_not_hire', 'archived');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "CandidateSource" AS ENUM ('manual_upload', 'referral', 'csv_import', 'google_forms_csv', 'other');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "RecruitmentDocumentType" AS ENUM ('resume', 'cover_letter', 'portfolio', 'assessment', 'offer_letter', 'identity', 'other');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "NoteVisibility" AS ENUM ('team', 'private', 'hr_only');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "IntakeItemStatus" AS ENUM ('received', 'parse_pending', 'parse_ready', 'duplicate_review', 'confirmed', 'discarded');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ApplicationPriority" AS ENUM ('low', 'normal', 'high', 'critical');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ApplicationStatus" AS ENUM ('active', 'hired', 'rejected', 'on_hold', 'withdrawn');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "RecruitmentPipelineStage" AS ENUM ('resume_received', 'screening', 'assessment', 'hr_round', 'technical_round', 'team_lead_round', 'manager_round', 'client_round', 'reference_check', 'decision', 'offer', 'hired', 'rejected', 'on_hold', 'withdrawn');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "InterviewStatus" AS ENUM ('draft', 'scheduled', 'completed', 'no_show', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "InterviewRoundType" AS ENUM ('screening', 'hr', 'technical', 'team_lead', 'manager', 'client', 'other');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "HiringDecisionOutcome" AS ENUM ('strong_hire', 'hire', 'borderline', 'hold', 'reject');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "OfferStatus" AS ENUM ('draft', 'manager_approval', 'hr_approval', 'released', 'accepted', 'declined', 'withdrawn');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "AiInsightType" AS ENUM ('resume_parse', 'profile_completion', 'quality_score', 'candidate_summary', 'duplicate_suggestion', 'job_match', 'interview_summary', 'decision_draft');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "AiInsightStatus" AS ENUM ('pending_review', 'accepted', 'dismissed', 'superseded');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "RecruitmentTimelineEntityType" AS ENUM ('job_opening', 'candidate', 'application', 'interview', 'offer', 'intake');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "SavedFilterEntity" AS ENUM ('applications', 'candidates', 'jobs', 'interviews', 'offers');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'recruitment_interview_scheduled';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'recruitment_stage_changed';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'recruitment_decision_pending';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'recruitment_offer_approval';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'recruitment_offer_released';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'recruitment_duplicate_found';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'recruitment_parse_ready';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'recruitment_mention';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'recruitment_converted';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'recruitment_sla_stale';

-- CreateTable
CREATE TABLE "recruitment_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "default_pipeline_template_id" TEXT,
    "sla_days_per_stage_json" JSONB NOT NULL DEFAULT '{}',
    "ai_enabled" BOOLEAN NOT NULL DEFAULT true,
    "require_decision_for_offer" BOOLEAN NOT NULL DEFAULT true,
    "skip_manager_approval_if_no_hm" BOOLEAN NOT NULL DEFAULT true,
    "hm_compensation_visible" BOOLEAN NOT NULL DEFAULT true,
    "allow_duplicate_active_app" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recruitment_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recruitment_pipeline_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "recruitment_pipeline_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recruitment_pipeline_template_stages" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "stage" "RecruitmentPipelineStage" NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "is_optional" BOOLEAN NOT NULL DEFAULT false,
    "label" TEXT,
    "sla_days" INTEGER,

    CONSTRAINT "recruitment_pipeline_template_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_openings" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "code" TEXT,
    "status" "JobOpeningStatus" NOT NULL DEFAULT 'draft',
    "department" TEXT,
    "location" TEXT,
    "work_mode" TEXT,
    "employment_type" "JobEmploymentType" NOT NULL DEFAULT 'full_time',
    "description" TEXT,
    "requirements" TEXT,
    "openings_count" INTEGER NOT NULL DEFAULT 1,
    "headcount_approved" BOOLEAN NOT NULL DEFAULT false,
    "headcount_requested_by_employee_id" INTEGER,
    "headcount_requested_at" TIMESTAMP(3),
    "headcount_urgency" TEXT,
    "compensation_currency" TEXT,
    "compensation_min" DECIMAL(14,2),
    "compensation_max" DECIMAL(14,2),
    "target_start_date" TIMESTAMP(3),
    "pipeline_template_id" TEXT,
    "owner_recruiter_user_id" TEXT,
    "published_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "filled_at" TIMESTAMP(3),
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "job_openings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_opening_stages" (
    "id" TEXT NOT NULL,
    "job_opening_id" TEXT NOT NULL,
    "stage" "RecruitmentPipelineStage" NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "is_optional" BOOLEAN NOT NULL DEFAULT false,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "label" TEXT,
    "sla_days" INTEGER,

    CONSTRAINT "job_opening_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hiring_team_members" (
    "id" TEXT NOT NULL,
    "job_opening_id" TEXT NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "role" "HiringTeamRole" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hiring_team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_opening_documents" (
    "id" TEXT NOT NULL,
    "job_opening_id" TEXT NOT NULL,
    "document_type" "RecruitmentDocumentType" NOT NULL DEFAULT 'other',
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT,
    "size_bytes" INTEGER,
    "storage_key" TEXT NOT NULL,
    "checksum" TEXT,
    "uploaded_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "job_opening_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_opening_notes" (
    "id" TEXT NOT NULL,
    "job_opening_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "visibility" "NoteVisibility" NOT NULL DEFAULT 'team',
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "is_resolved" BOOLEAN NOT NULL DEFAULT false,
    "author_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "job_opening_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidates" (
    "id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "preferred_name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "alternate_phone" TEXT,
    "location" TEXT,
    "current_company" TEXT,
    "current_title" TEXT,
    "linkedin_url" TEXT,
    "source" "CandidateSource" NOT NULL DEFAULT 'manual_upload',
    "status" "CandidateStatus" NOT NULL DEFAULT 'active',
    "do_not_hire_reason" TEXT,
    "current_ctc" DECIMAL(14,2),
    "expected_ctc" DECIMAL(14,2),
    "currency" TEXT DEFAULT 'INR',
    "notice_period_days" INTEGER,
    "earliest_join_date" TIMESTAMP(3),
    "availability_notes" TEXT,
    "timezone" TEXT,
    "primary_recruiter_user_id" TEXT,
    "referred_by_employee_id" INTEGER,
    "employee_id" INTEGER,
    "merged_into_candidate_id" TEXT,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_documents" (
    "id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "document_type" "RecruitmentDocumentType" NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT,
    "size_bytes" INTEGER,
    "storage_key" TEXT NOT NULL,
    "checksum" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "uploaded_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "candidate_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_experiences" (
    "id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "location" TEXT,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidate_experiences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_educations" (
    "id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "degree" TEXT,
    "field" TEXT,
    "start_year" INTEGER,
    "end_year" INTEGER,
    "notes" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidate_educations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_skills" (
    "id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "proficiency" TEXT,
    "is_confirmed" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidate_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_projects" (
    "id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "tech_stack" TEXT,
    "url" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidate_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_certifications" (
    "id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuer" TEXT,
    "issued_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "credential_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidate_certifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_notes" (
    "id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "visibility" "NoteVisibility" NOT NULL DEFAULT 'team',
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "is_resolved" BOOLEAN NOT NULL DEFAULT false,
    "author_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "candidate_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_chat_messages" (
    "id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "author_user_id" TEXT NOT NULL,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "promoted_note_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "candidate_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recruitment_tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recruitment_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_tags" (
    "candidate_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidate_tags_pkey" PRIMARY KEY ("candidate_id","tag_id")
);

-- CreateTable
CREATE TABLE "talent_pool_entries" (
    "id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "reason" TEXT,
    "source_application_id" TEXT,
    "entered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exited_at" TIMESTAMP(3),
    "created_by_user_id" TEXT,

    CONSTRAINT "talent_pool_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_ai_insights" (
    "id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "application_id" TEXT,
    "insight_type" "AiInsightType" NOT NULL,
    "status" "AiInsightStatus" NOT NULL DEFAULT 'pending_review',
    "title" TEXT,
    "content_json" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION,
    "model_id" TEXT,
    "created_by_user_id" TEXT,
    "reviewed_by_user_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidate_ai_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recruitment_intake_items" (
    "id" TEXT NOT NULL,
    "status" "IntakeItemStatus" NOT NULL DEFAULT 'received',
    "source" "CandidateSource" NOT NULL,
    "raw_payload_json" JSONB NOT NULL DEFAULT '{}',
    "file_name" TEXT,
    "storage_key" TEXT,
    "candidate_id" TEXT,
    "job_opening_id" TEXT,
    "duplicate_of_candidate_id" TEXT,
    "duplicate_confidence" DOUBLE PRECISION,
    "error_message" TEXT,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recruitment_intake_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recruitment_applications" (
    "id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "job_opening_id" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'active',
    "current_stage" "RecruitmentPipelineStage" NOT NULL DEFAULT 'resume_received',
    "stage_entered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "priority" "ApplicationPriority" NOT NULL DEFAULT 'normal',
    "assigned_recruiter_user_id" TEXT,
    "assigned_manager_employee_id" INTEGER,
    "source" "CandidateSource",
    "risk_flags_json" JSONB NOT NULL DEFAULT '[]',
    "aggregate_score" DOUBLE PRECISION,
    "rejected_reason" TEXT,
    "hold_reason" TEXT,
    "withdrawn_reason" TEXT,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "recruitment_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_stage_history" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "from_stage" "RecruitmentPipelineStage",
    "to_stage" "RecruitmentPipelineStage" NOT NULL,
    "note" TEXT,
    "is_override" BOOLEAN NOT NULL DEFAULT false,
    "actor_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_stage_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recruitment_interviews" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "round_type" "InterviewRoundType" NOT NULL,
    "status" "InterviewStatus" NOT NULL DEFAULT 'draft',
    "title" TEXT,
    "scheduled_start" TIMESTAMP(3),
    "scheduled_end" TIMESTAMP(3),
    "timezone" TEXT,
    "location" TEXT,
    "meeting_url" TEXT,
    "transcript_text" TEXT,
    "recording_url" TEXT,
    "summary" TEXT,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "recruitment_interviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_panelists" (
    "id" TEXT NOT NULL,
    "interview_id" TEXT NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "is_observer" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interview_panelists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_feedback" (
    "id" TEXT NOT NULL,
    "interview_id" TEXT NOT NULL,
    "author_employee_id" INTEGER NOT NULL,
    "overall_rating" DOUBLE PRECISION,
    "ratings_json" JSONB NOT NULL DEFAULT '{}',
    "recommendation" TEXT,
    "strengths" TEXT,
    "concerns" TEXT,
    "private_notes" TEXT,
    "submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interview_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_attachments" (
    "id" TEXT NOT NULL,
    "interview_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT,
    "size_bytes" INTEGER,
    "storage_key" TEXT NOT NULL,
    "uploaded_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "interview_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hiring_decisions" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "outcome" "HiringDecisionOutcome" NOT NULL,
    "rationale" TEXT NOT NULL,
    "strengths" TEXT NOT NULL,
    "concerns" TEXT,
    "salary_recommendation" DECIMAL(14,2),
    "currency" TEXT,
    "risk_tags_json" JSONB NOT NULL DEFAULT '[]',
    "version" INTEGER NOT NULL,
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "decided_by_user_id" TEXT NOT NULL,
    "decided_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hiring_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recruitment_offers" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "hiring_decision_id" TEXT NOT NULL,
    "status" "OfferStatus" NOT NULL DEFAULT 'draft',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "base_salary" DECIMAL(14,2) NOT NULL,
    "variable_pay" DECIMAL(14,2),
    "benefits_notes" TEXT,
    "proposed_start_date" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "manager_approval_skipped" BOOLEAN NOT NULL DEFAULT false,
    "manager_approved_by_user_id" TEXT,
    "manager_approved_at" TIMESTAMP(3),
    "hr_approved_by_user_id" TEXT,
    "hr_approved_at" TIMESTAMP(3),
    "released_at" TIMESTAMP(3),
    "accepted_at" TIMESTAMP(3),
    "declined_at" TIMESTAMP(3),
    "withdrawn_at" TIMESTAMP(3),
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recruitment_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offer_revisions" (
    "id" TEXT NOT NULL,
    "offer_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot_json" JSONB NOT NULL,
    "change_note" TEXT,
    "actor_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offer_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_conversion_snapshots" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "offer_id" TEXT NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "field_map_version" TEXT NOT NULL,
    "mapped_fields" JSONB NOT NULL,
    "override_reason" TEXT,
    "converted_by_user_id" TEXT NOT NULL,
    "converted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_conversion_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recruitment_timeline_events" (
    "id" TEXT NOT NULL,
    "entity_type" "RecruitmentTimelineEntityType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "application_id" TEXT,
    "candidate_id" TEXT,
    "job_opening_id" TEXT,
    "event_type" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recruitment_timeline_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recruitment_metric_snapshots" (
    "id" TEXT NOT NULL,
    "metric_key" TEXT NOT NULL,
    "scope_type" TEXT NOT NULL,
    "scope_key" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "payload_json" JSONB NOT NULL DEFAULT '{}',
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recruitment_metric_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recruitment_saved_filters" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "entity" "SavedFilterEntity" NOT NULL,
    "name" TEXT NOT NULL,
    "filter_json" JSONB NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recruitment_saved_filters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recruitment_pipeline_templates_is_active_deleted_at_idx" ON "recruitment_pipeline_templates"("is_active", "deleted_at");

-- CreateIndex
CREATE INDEX "recruitment_pipeline_template_stages_template_id_idx" ON "recruitment_pipeline_template_stages"("template_id");

-- CreateIndex
CREATE UNIQUE INDEX "recruitment_pipeline_template_stages_template_id_stage_key" ON "recruitment_pipeline_template_stages"("template_id", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "recruitment_pipeline_template_stages_template_id_sort_order_key" ON "recruitment_pipeline_template_stages"("template_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "job_openings_code_key" ON "job_openings"("code");

-- CreateIndex
CREATE INDEX "job_openings_status_deleted_at_idx" ON "job_openings"("status", "deleted_at");

-- CreateIndex
CREATE INDEX "job_openings_department_idx" ON "job_openings"("department");

-- CreateIndex
CREATE INDEX "job_openings_owner_recruiter_user_id_status_idx" ON "job_openings"("owner_recruiter_user_id", "status");

-- CreateIndex
CREATE INDEX "job_openings_created_at_idx" ON "job_openings"("created_at");

-- CreateIndex
CREATE INDEX "job_openings_deleted_at_idx" ON "job_openings"("deleted_at");

-- CreateIndex
CREATE INDEX "job_opening_stages_job_opening_id_idx" ON "job_opening_stages"("job_opening_id");

-- CreateIndex
CREATE UNIQUE INDEX "job_opening_stages_job_opening_id_stage_key" ON "job_opening_stages"("job_opening_id", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "job_opening_stages_job_opening_id_sort_order_key" ON "job_opening_stages"("job_opening_id", "sort_order");

-- CreateIndex
CREATE INDEX "hiring_team_members_employee_id_role_idx" ON "hiring_team_members"("employee_id", "role");

-- CreateIndex
CREATE INDEX "hiring_team_members_job_opening_id_role_idx" ON "hiring_team_members"("job_opening_id", "role");

-- CreateIndex
CREATE INDEX "hiring_team_members_employee_id_job_opening_id_idx" ON "hiring_team_members"("employee_id", "job_opening_id");

-- CreateIndex
CREATE UNIQUE INDEX "hiring_team_members_job_opening_id_employee_id_role_key" ON "hiring_team_members"("job_opening_id", "employee_id", "role");

-- CreateIndex
CREATE INDEX "job_opening_documents_job_opening_id_deleted_at_idx" ON "job_opening_documents"("job_opening_id", "deleted_at");

-- CreateIndex
CREATE INDEX "job_opening_notes_job_opening_id_deleted_at_idx" ON "job_opening_notes"("job_opening_id", "deleted_at");

-- CreateIndex
CREATE INDEX "job_opening_notes_job_opening_id_is_pinned_idx" ON "job_opening_notes"("job_opening_id", "is_pinned");

-- CreateIndex
CREATE UNIQUE INDEX "candidates_employee_id_key" ON "candidates"("employee_id");

-- CreateIndex
CREATE INDEX "candidates_status_deleted_at_idx" ON "candidates"("status", "deleted_at");

-- CreateIndex
CREATE INDEX "candidates_email_idx" ON "candidates"("email");

-- CreateIndex
CREATE INDEX "candidates_phone_idx" ON "candidates"("phone");

-- CreateIndex
CREATE INDEX "candidates_source_idx" ON "candidates"("source");

-- CreateIndex
CREATE INDEX "candidates_primary_recruiter_user_id_idx" ON "candidates"("primary_recruiter_user_id");

-- CreateIndex
CREATE INDEX "candidates_created_at_idx" ON "candidates"("created_at");

-- CreateIndex
CREATE INDEX "candidates_full_name_idx" ON "candidates"("full_name");

-- CreateIndex
CREATE INDEX "candidates_deleted_at_idx" ON "candidates"("deleted_at");

-- CreateIndex
CREATE INDEX "candidate_documents_candidate_id_document_type_deleted_at_idx" ON "candidate_documents"("candidate_id", "document_type", "deleted_at");

-- CreateIndex
CREATE INDEX "candidate_documents_candidate_id_is_primary_idx" ON "candidate_documents"("candidate_id", "is_primary");

-- CreateIndex
CREATE INDEX "candidate_experiences_candidate_id_sort_order_idx" ON "candidate_experiences"("candidate_id", "sort_order");

-- CreateIndex
CREATE INDEX "candidate_educations_candidate_id_idx" ON "candidate_educations"("candidate_id");

-- CreateIndex
CREATE INDEX "candidate_skills_name_idx" ON "candidate_skills"("name");

-- CreateIndex
CREATE UNIQUE INDEX "candidate_skills_candidate_id_name_key" ON "candidate_skills"("candidate_id", "name");

-- CreateIndex
CREATE INDEX "candidate_projects_candidate_id_idx" ON "candidate_projects"("candidate_id");

-- CreateIndex
CREATE INDEX "candidate_certifications_candidate_id_idx" ON "candidate_certifications"("candidate_id");

-- CreateIndex
CREATE INDEX "candidate_notes_candidate_id_deleted_at_idx" ON "candidate_notes"("candidate_id", "deleted_at");

-- CreateIndex
CREATE INDEX "candidate_notes_candidate_id_is_pinned_idx" ON "candidate_notes"("candidate_id", "is_pinned");

-- CreateIndex
CREATE INDEX "candidate_chat_messages_candidate_id_created_at_idx" ON "candidate_chat_messages"("candidate_id", "created_at");

-- CreateIndex
CREATE INDEX "candidate_chat_messages_candidate_id_deleted_at_idx" ON "candidate_chat_messages"("candidate_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "recruitment_tags_name_key" ON "recruitment_tags"("name");

-- CreateIndex
CREATE INDEX "candidate_tags_tag_id_idx" ON "candidate_tags"("tag_id");

-- CreateIndex
CREATE INDEX "talent_pool_entries_candidate_id_exited_at_idx" ON "talent_pool_entries"("candidate_id", "exited_at");

-- CreateIndex
CREATE INDEX "talent_pool_entries_entered_at_idx" ON "talent_pool_entries"("entered_at");

-- CreateIndex
CREATE INDEX "candidate_ai_insights_candidate_id_status_idx" ON "candidate_ai_insights"("candidate_id", "status");

-- CreateIndex
CREATE INDEX "candidate_ai_insights_insight_type_status_idx" ON "candidate_ai_insights"("insight_type", "status");

-- CreateIndex
CREATE INDEX "candidate_ai_insights_created_at_idx" ON "candidate_ai_insights"("created_at");

-- CreateIndex
CREATE INDEX "recruitment_intake_items_status_created_at_idx" ON "recruitment_intake_items"("status", "created_at");

-- CreateIndex
CREATE INDEX "recruitment_intake_items_job_opening_id_idx" ON "recruitment_intake_items"("job_opening_id");

-- CreateIndex
CREATE INDEX "recruitment_intake_items_candidate_id_idx" ON "recruitment_intake_items"("candidate_id");

-- CreateIndex
CREATE INDEX "recruitment_applications_job_opening_id_current_stage_delet_idx" ON "recruitment_applications"("job_opening_id", "current_stage", "deleted_at");

-- CreateIndex
CREATE INDEX "recruitment_applications_candidate_id_deleted_at_idx" ON "recruitment_applications"("candidate_id", "deleted_at");

-- CreateIndex
CREATE INDEX "recruitment_applications_status_current_stage_idx" ON "recruitment_applications"("status", "current_stage");

-- CreateIndex
CREATE INDEX "recruitment_applications_assigned_recruiter_user_id_status_idx" ON "recruitment_applications"("assigned_recruiter_user_id", "status");

-- CreateIndex
CREATE INDEX "recruitment_applications_assigned_manager_employee_id_statu_idx" ON "recruitment_applications"("assigned_manager_employee_id", "status");

-- CreateIndex
CREATE INDEX "recruitment_applications_priority_current_stage_idx" ON "recruitment_applications"("priority", "current_stage");

-- CreateIndex
CREATE INDEX "recruitment_applications_stage_entered_at_idx" ON "recruitment_applications"("stage_entered_at");

-- CreateIndex
CREATE INDEX "recruitment_applications_created_at_idx" ON "recruitment_applications"("created_at");

-- CreateIndex
CREATE INDEX "recruitment_applications_candidate_id_job_opening_id_idx" ON "recruitment_applications"("candidate_id", "job_opening_id");

-- CreateIndex
CREATE INDEX "application_stage_history_application_id_created_at_idx" ON "application_stage_history"("application_id", "created_at");

-- CreateIndex
CREATE INDEX "application_stage_history_to_stage_created_at_idx" ON "application_stage_history"("to_stage", "created_at");

-- CreateIndex
CREATE INDEX "recruitment_interviews_application_id_status_idx" ON "recruitment_interviews"("application_id", "status");

-- CreateIndex
CREATE INDEX "recruitment_interviews_scheduled_start_idx" ON "recruitment_interviews"("scheduled_start");

-- CreateIndex
CREATE INDEX "recruitment_interviews_status_scheduled_start_idx" ON "recruitment_interviews"("status", "scheduled_start");

-- CreateIndex
CREATE INDEX "interview_panelists_employee_id_idx" ON "interview_panelists"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "interview_panelists_interview_id_employee_id_key" ON "interview_panelists"("interview_id", "employee_id");

-- CreateIndex
CREATE INDEX "interview_feedback_author_employee_id_idx" ON "interview_feedback"("author_employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "interview_feedback_interview_id_author_employee_id_key" ON "interview_feedback"("interview_id", "author_employee_id");

-- CreateIndex
CREATE INDEX "interview_attachments_interview_id_idx" ON "interview_attachments"("interview_id");

-- CreateIndex
CREATE INDEX "hiring_decisions_application_id_is_current_idx" ON "hiring_decisions"("application_id", "is_current");

-- CreateIndex
CREATE INDEX "hiring_decisions_outcome_decided_at_idx" ON "hiring_decisions"("outcome", "decided_at");

-- CreateIndex
CREATE UNIQUE INDEX "hiring_decisions_application_id_version_key" ON "hiring_decisions"("application_id", "version");

-- CreateIndex
CREATE INDEX "recruitment_offers_application_id_status_idx" ON "recruitment_offers"("application_id", "status");

-- CreateIndex
CREATE INDEX "recruitment_offers_status_created_at_idx" ON "recruitment_offers"("status", "created_at");

-- CreateIndex
CREATE INDEX "recruitment_offers_hiring_decision_id_idx" ON "recruitment_offers"("hiring_decision_id");

-- CreateIndex
CREATE INDEX "offer_revisions_offer_id_idx" ON "offer_revisions"("offer_id");

-- CreateIndex
CREATE UNIQUE INDEX "offer_revisions_offer_id_version_key" ON "offer_revisions"("offer_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "employee_conversion_snapshots_application_id_key" ON "employee_conversion_snapshots"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_conversion_snapshots_candidate_id_key" ON "employee_conversion_snapshots"("candidate_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_conversion_snapshots_offer_id_key" ON "employee_conversion_snapshots"("offer_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_conversion_snapshots_employee_id_key" ON "employee_conversion_snapshots"("employee_id");

-- CreateIndex
CREATE INDEX "employee_conversion_snapshots_converted_at_idx" ON "employee_conversion_snapshots"("converted_at");

-- CreateIndex
CREATE INDEX "recruitment_timeline_events_entity_type_entity_id_created_a_idx" ON "recruitment_timeline_events"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "recruitment_timeline_events_application_id_created_at_idx" ON "recruitment_timeline_events"("application_id", "created_at");

-- CreateIndex
CREATE INDEX "recruitment_timeline_events_candidate_id_created_at_idx" ON "recruitment_timeline_events"("candidate_id", "created_at");

-- CreateIndex
CREATE INDEX "recruitment_timeline_events_job_opening_id_created_at_idx" ON "recruitment_timeline_events"("job_opening_id", "created_at");

-- CreateIndex
CREATE INDEX "recruitment_timeline_events_event_type_created_at_idx" ON "recruitment_timeline_events"("event_type", "created_at");

-- CreateIndex
CREATE INDEX "recruitment_metric_snapshots_metric_key_period_start_idx" ON "recruitment_metric_snapshots"("metric_key", "period_start");

-- CreateIndex
CREATE INDEX "recruitment_metric_snapshots_scope_type_scope_key_idx" ON "recruitment_metric_snapshots"("scope_type", "scope_key");

-- CreateIndex
CREATE UNIQUE INDEX "recruitment_metric_snapshots_metric_key_scope_type_scope_ke_key" ON "recruitment_metric_snapshots"("metric_key", "scope_type", "scope_key", "period_start", "period_end");

-- CreateIndex
CREATE INDEX "recruitment_saved_filters_user_id_entity_idx" ON "recruitment_saved_filters"("user_id", "entity");

-- CreateIndex
CREATE UNIQUE INDEX "recruitment_saved_filters_user_id_entity_name_key" ON "recruitment_saved_filters"("user_id", "entity", "name");

-- AddForeignKey
ALTER TABLE "recruitment_settings" ADD CONSTRAINT "recruitment_settings_default_pipeline_template_id_fkey" FOREIGN KEY ("default_pipeline_template_id") REFERENCES "recruitment_pipeline_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruitment_pipeline_templates" ADD CONSTRAINT "recruitment_pipeline_templates_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruitment_pipeline_template_stages" ADD CONSTRAINT "recruitment_pipeline_template_stages_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "recruitment_pipeline_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_openings" ADD CONSTRAINT "job_openings_headcount_requested_by_employee_id_fkey" FOREIGN KEY ("headcount_requested_by_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_openings" ADD CONSTRAINT "job_openings_pipeline_template_id_fkey" FOREIGN KEY ("pipeline_template_id") REFERENCES "recruitment_pipeline_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_openings" ADD CONSTRAINT "job_openings_owner_recruiter_user_id_fkey" FOREIGN KEY ("owner_recruiter_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_openings" ADD CONSTRAINT "job_openings_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_opening_stages" ADD CONSTRAINT "job_opening_stages_job_opening_id_fkey" FOREIGN KEY ("job_opening_id") REFERENCES "job_openings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hiring_team_members" ADD CONSTRAINT "hiring_team_members_job_opening_id_fkey" FOREIGN KEY ("job_opening_id") REFERENCES "job_openings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hiring_team_members" ADD CONSTRAINT "hiring_team_members_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_opening_documents" ADD CONSTRAINT "job_opening_documents_job_opening_id_fkey" FOREIGN KEY ("job_opening_id") REFERENCES "job_openings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_opening_documents" ADD CONSTRAINT "job_opening_documents_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_opening_notes" ADD CONSTRAINT "job_opening_notes_job_opening_id_fkey" FOREIGN KEY ("job_opening_id") REFERENCES "job_openings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_opening_notes" ADD CONSTRAINT "job_opening_notes_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_primary_recruiter_user_id_fkey" FOREIGN KEY ("primary_recruiter_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_referred_by_employee_id_fkey" FOREIGN KEY ("referred_by_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_merged_into_candidate_id_fkey" FOREIGN KEY ("merged_into_candidate_id") REFERENCES "candidates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_documents" ADD CONSTRAINT "candidate_documents_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_documents" ADD CONSTRAINT "candidate_documents_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_experiences" ADD CONSTRAINT "candidate_experiences_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_educations" ADD CONSTRAINT "candidate_educations_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_skills" ADD CONSTRAINT "candidate_skills_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_projects" ADD CONSTRAINT "candidate_projects_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_certifications" ADD CONSTRAINT "candidate_certifications_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_notes" ADD CONSTRAINT "candidate_notes_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_notes" ADD CONSTRAINT "candidate_notes_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_chat_messages" ADD CONSTRAINT "candidate_chat_messages_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_chat_messages" ADD CONSTRAINT "candidate_chat_messages_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_tags" ADD CONSTRAINT "candidate_tags_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_tags" ADD CONSTRAINT "candidate_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "recruitment_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_pool_entries" ADD CONSTRAINT "talent_pool_entries_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_ai_insights" ADD CONSTRAINT "candidate_ai_insights_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruitment_intake_items" ADD CONSTRAINT "recruitment_intake_items_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruitment_intake_items" ADD CONSTRAINT "recruitment_intake_items_job_opening_id_fkey" FOREIGN KEY ("job_opening_id") REFERENCES "job_openings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruitment_intake_items" ADD CONSTRAINT "recruitment_intake_items_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruitment_applications" ADD CONSTRAINT "recruitment_applications_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruitment_applications" ADD CONSTRAINT "recruitment_applications_job_opening_id_fkey" FOREIGN KEY ("job_opening_id") REFERENCES "job_openings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruitment_applications" ADD CONSTRAINT "recruitment_applications_assigned_recruiter_user_id_fkey" FOREIGN KEY ("assigned_recruiter_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruitment_applications" ADD CONSTRAINT "recruitment_applications_assigned_manager_employee_id_fkey" FOREIGN KEY ("assigned_manager_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruitment_applications" ADD CONSTRAINT "recruitment_applications_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_stage_history" ADD CONSTRAINT "application_stage_history_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "recruitment_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_stage_history" ADD CONSTRAINT "application_stage_history_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruitment_interviews" ADD CONSTRAINT "recruitment_interviews_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "recruitment_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruitment_interviews" ADD CONSTRAINT "recruitment_interviews_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_panelists" ADD CONSTRAINT "interview_panelists_interview_id_fkey" FOREIGN KEY ("interview_id") REFERENCES "recruitment_interviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_panelists" ADD CONSTRAINT "interview_panelists_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_feedback" ADD CONSTRAINT "interview_feedback_interview_id_fkey" FOREIGN KEY ("interview_id") REFERENCES "recruitment_interviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_feedback" ADD CONSTRAINT "interview_feedback_author_employee_id_fkey" FOREIGN KEY ("author_employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_attachments" ADD CONSTRAINT "interview_attachments_interview_id_fkey" FOREIGN KEY ("interview_id") REFERENCES "recruitment_interviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hiring_decisions" ADD CONSTRAINT "hiring_decisions_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "recruitment_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hiring_decisions" ADD CONSTRAINT "hiring_decisions_decided_by_user_id_fkey" FOREIGN KEY ("decided_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruitment_offers" ADD CONSTRAINT "recruitment_offers_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "recruitment_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruitment_offers" ADD CONSTRAINT "recruitment_offers_hiring_decision_id_fkey" FOREIGN KEY ("hiring_decision_id") REFERENCES "hiring_decisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruitment_offers" ADD CONSTRAINT "recruitment_offers_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_revisions" ADD CONSTRAINT "offer_revisions_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "recruitment_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_conversion_snapshots" ADD CONSTRAINT "employee_conversion_snapshots_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "recruitment_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_conversion_snapshots" ADD CONSTRAINT "employee_conversion_snapshots_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_conversion_snapshots" ADD CONSTRAINT "employee_conversion_snapshots_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "recruitment_offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_conversion_snapshots" ADD CONSTRAINT "employee_conversion_snapshots_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_conversion_snapshots" ADD CONSTRAINT "employee_conversion_snapshots_converted_by_user_id_fkey" FOREIGN KEY ("converted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruitment_saved_filters" ADD CONSTRAINT "recruitment_saved_filters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =============================================================================
-- Partial unique indexes (Prisma cannot express these)
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS "candidates_email_live_unique"
  ON "candidates" (lower("email"))
  WHERE "deleted_at" IS NULL
    AND "email" IS NOT NULL
    AND "merged_into_candidate_id" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "recruitment_applications_active_candidate_job_unique"
  ON "recruitment_applications" ("candidate_id", "job_opening_id")
  WHERE "deleted_at" IS NULL
    AND "status" = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS "hiring_team_members_one_hm_per_job"
  ON "hiring_team_members" ("job_opening_id")
  WHERE "role" = 'hiring_manager';

CREATE UNIQUE INDEX IF NOT EXISTS "hiring_decisions_one_current_per_application"
  ON "hiring_decisions" ("application_id")
  WHERE "is_current" = true;

CREATE UNIQUE INDEX IF NOT EXISTS "candidate_documents_one_primary_resume"
  ON "candidate_documents" ("candidate_id")
  WHERE "document_type" = 'resume'
    AND "is_primary" = true
    AND "deleted_at" IS NULL;

-- =============================================================================
-- Seed: default pipeline template + settings singleton
-- =============================================================================

INSERT INTO "recruitment_pipeline_templates" ("id", "name", "description", "is_system", "is_active", "created_at", "updated_at")
VALUES (
  'recruitment_default_pipeline_v1',
  'Default Hiring Pipeline',
  'System default recruitment pipeline (Phase 0 seed)',
  true,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "recruitment_pipeline_template_stages" ("id", "template_id", "stage", "sort_order", "is_optional", "label", "sla_days")
VALUES
  ('rpts_resume_received', 'recruitment_default_pipeline_v1', 'resume_received', 10, false, 'Resume Received', 2),
  ('rpts_screening', 'recruitment_default_pipeline_v1', 'screening', 20, false, 'Screening', 3),
  ('rpts_assessment', 'recruitment_default_pipeline_v1', 'assessment', 30, true, 'Assessment', 5),
  ('rpts_hr_round', 'recruitment_default_pipeline_v1', 'hr_round', 40, true, 'HR Round', 5),
  ('rpts_technical_round', 'recruitment_default_pipeline_v1', 'technical_round', 50, true, 'Technical Round', 5),
  ('rpts_team_lead_round', 'recruitment_default_pipeline_v1', 'team_lead_round', 60, true, 'Team Lead Round', 5),
  ('rpts_manager_round', 'recruitment_default_pipeline_v1', 'manager_round', 70, false, 'Manager Round', 5),
  ('rpts_client_round', 'recruitment_default_pipeline_v1', 'client_round', 80, true, 'Client Round', 5),
  ('rpts_reference_check', 'recruitment_default_pipeline_v1', 'reference_check', 90, true, 'Reference Check', 5),
  ('rpts_decision', 'recruitment_default_pipeline_v1', 'decision', 100, false, 'Decision', 3),
  ('rpts_offer', 'recruitment_default_pipeline_v1', 'offer', 110, false, 'Offer', 5),
  ('rpts_hired', 'recruitment_default_pipeline_v1', 'hired', 120, false, 'Hired', NULL)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "recruitment_settings" (
  "id",
  "default_pipeline_template_id",
  "sla_days_per_stage_json",
  "ai_enabled",
  "require_decision_for_offer",
  "skip_manager_approval_if_no_hm",
  "hm_compensation_visible",
  "allow_duplicate_active_app",
  "metadata",
  "updated_at"
)
VALUES (
  'default',
  'recruitment_default_pipeline_v1',
  '{}',
  true,
  true,
  true,
  true,
  false,
  '{}',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;
