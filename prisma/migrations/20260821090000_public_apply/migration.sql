-- Public /apply candidate intake (Phase 3, P0)
--
-- Adds:
--   1. JobOpening public-visibility columns (isPubliclyListed, publicSlug)
--   2. CandidateSource.career_portal enum value
--   3. PublicApplicationSubmission table (temp intake holding — see schema.prisma
--      doc comment; never becomes a second candidate database, only audit JSON)
--   4. Partial unique index closing the concurrent-double-submit race documented
--      but not previously enforced at prisma/schema.prisma (Application model
--      comment): at most one ACTIVE, non-deleted Application per (candidate, job).
--
-- Migration risk: step 4's CREATE UNIQUE INDEX fails if duplicate active
-- applications already exist for some (candidate_id, job_opening_id) pair.
-- Inspect before deploy:
--   SELECT candidate_id, job_opening_id, COUNT(*)
--   FROM recruitment_applications
--   WHERE deleted_at IS NULL AND status = 'active'
--   GROUP BY 1, 2 HAVING COUNT(*) > 1;
-- Do NOT auto-resolve duplicates in this migration — resolve manually first
-- (reject/withdraw the extra rows) if the check above returns anything.

-- AlterEnum
ALTER TYPE "CandidateSource" ADD VALUE 'career_portal';

-- CreateEnum
CREATE TYPE "PublicSubmissionStatus" AS ENUM (
  'started',
  'basic_info_complete',
  'resume_uploaded',
  'parsing',
  'ready_for_review',
  'candidate_edited',
  'parse_failed',
  'upload_failed',
  'submission_failed',
  'submitted',
  'job_closed',
  'expired'
);

-- AlterTable
ALTER TABLE "job_openings"
  ADD COLUMN "is_publicly_listed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "public_slug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "job_openings_public_slug_key" ON "job_openings"("public_slug");

-- CreateIndex
CREATE INDEX "job_openings_is_publicly_listed_status_idx" ON "job_openings"("is_publicly_listed", "status");

-- CreateTable
CREATE TABLE "public_application_submissions" (
    "id" TEXT NOT NULL,
    "status" "PublicSubmissionStatus" NOT NULL DEFAULT 'started',
    "job_opening_id" TEXT NOT NULL,

    "full_name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "normalized_email" TEXT,
    "normalized_phone" TEXT,

    "resume_file_name" TEXT,
    "resume_mime_type" TEXT,
    "resume_size_bytes" INTEGER,
    "resume_storage_key" TEXT,
    "resume_checksum" TEXT,

    "parser_version" TEXT,
    "parse_failure_reason" TEXT,
    "parsed_proposal_json" JSONB,
    "candidate_edited_json" JSONB,
    "submitted_snapshot_json" JSONB,

    "consent_given_at" TIMESTAMP(3),

    "duplicate_of_candidate_id" TEXT,
    "duplicate_confidence" DOUBLE PRECISION,

    "resolved_candidate_id" TEXT,
    "resolved_application_id" TEXT,
    "reference_code" TEXT,

    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "ip_hash" TEXT,

    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "public_application_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "public_application_submissions_job_opening_id_status_idx" ON "public_application_submissions"("job_opening_id", "status");

-- CreateIndex
CREATE INDEX "public_application_submissions_status_expires_at_idx" ON "public_application_submissions"("status", "expires_at");

-- CreateIndex
CREATE INDEX "public_application_submissions_normalized_email_idx" ON "public_application_submissions"("normalized_email");

-- CreateIndex
CREATE INDEX "public_application_submissions_created_at_idx" ON "public_application_submissions"("created_at");

-- AddForeignKey
ALTER TABLE "public_application_submissions" ADD CONSTRAINT "public_application_submissions_job_opening_id_fkey" FOREIGN KEY ("job_opening_id") REFERENCES "job_openings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Concurrency guard: at most one active, non-deleted Application per
-- (candidate, job). Previously documented only as a schema comment on
-- Application (prisma/schema.prisma) — never enforced at the DB level.
-- Public, anonymous, multi-tab traffic is exactly the profile that turns the
-- app-level findActiveByCandidateAndJob() check into a real race, so this is
-- promoted to a required constraint as part of shipping public intake.
CREATE UNIQUE INDEX IF NOT EXISTS "recruitment_applications_active_candidate_job_uidx"
  ON "recruitment_applications" ("candidate_id", "job_opening_id")
  WHERE "deleted_at" IS NULL AND "status" = 'active';
