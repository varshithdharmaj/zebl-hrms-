-- CreateEnum
CREATE TYPE "RecruitmentCommunicationType" AS ENUM (
  'email_sent',
  'email_received',
  'interview_invitation',
  'interview_reminder',
  'offer_letter',
  'rejection',
  'internal_note',
  'system_notification'
);

-- CreateEnum
CREATE TYPE "RecruitmentCommunicationStatus" AS ENUM (
  'draft',
  'scheduled',
  'sent',
  'delivered',
  'failed',
  'cancelled'
);

-- CreateEnum
CREATE TYPE "RecruitmentEmailTemplateType" AS ENUM (
  'interview_invitation',
  'interview_reminder',
  'interview_cancelled',
  'interview_rescheduled',
  'offer_letter',
  'offer_reminder',
  'offer_expired',
  'rejection',
  'welcome',
  'general'
);

-- CreateTable
CREATE TABLE "recruitment_email_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "RecruitmentEmailTemplateType" NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "recruitment_email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recruitment_communications" (
    "id" TEXT NOT NULL,
    "type" "RecruitmentCommunicationType" NOT NULL,
    "status" "RecruitmentCommunicationStatus" NOT NULL DEFAULT 'draft',
    "subject" TEXT,
    "body" TEXT,
    "candidate_id" TEXT,
    "application_id" TEXT,
    "job_opening_id" TEXT,
    "interview_id" TEXT,
    "offer_id" TEXT,
    "template_id" TEXT,
    "sender_user_id" TEXT,
    "recipient_email" TEXT,
    "thread_id" TEXT,
    "parent_id" TEXT,
    "sent_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "scheduled_for" TIMESTAMP(3),
    "error_message" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "recruitment_communications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recruitment_communication_attachments" (
    "id" TEXT NOT NULL,
    "communication_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "storage_path" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recruitment_communication_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recruitment_email_templates_type_is_active_idx" ON "recruitment_email_templates"("type", "is_active");
CREATE INDEX "recruitment_email_templates_deleted_at_idx" ON "recruitment_email_templates"("deleted_at");

CREATE INDEX "recruitment_communications_candidate_id_created_at_idx" ON "recruitment_communications"("candidate_id", "created_at");
CREATE INDEX "recruitment_communications_application_id_created_at_idx" ON "recruitment_communications"("application_id", "created_at");
CREATE INDEX "recruitment_communications_status_scheduled_for_idx" ON "recruitment_communications"("status", "scheduled_for");
CREATE INDEX "recruitment_communications_sender_user_id_created_at_idx" ON "recruitment_communications"("sender_user_id", "created_at");
CREATE INDEX "recruitment_communications_thread_id_created_at_idx" ON "recruitment_communications"("thread_id", "created_at");
CREATE INDEX "recruitment_communications_type_status_idx" ON "recruitment_communications"("type", "status");
CREATE INDEX "recruitment_communications_deleted_at_idx" ON "recruitment_communications"("deleted_at");

CREATE INDEX "recruitment_communication_attachments_communication_id_idx" ON "recruitment_communication_attachments"("communication_id");

-- AddForeignKey
ALTER TABLE "recruitment_email_templates" ADD CONSTRAINT "recruitment_email_templates_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "recruitment_communications" ADD CONSTRAINT "recruitment_communications_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "recruitment_communications" ADD CONSTRAINT "recruitment_communications_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "recruitment_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "recruitment_communications" ADD CONSTRAINT "recruitment_communications_job_opening_id_fkey" FOREIGN KEY ("job_opening_id") REFERENCES "job_openings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "recruitment_communications" ADD CONSTRAINT "recruitment_communications_interview_id_fkey" FOREIGN KEY ("interview_id") REFERENCES "recruitment_interviews"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "recruitment_communications" ADD CONSTRAINT "recruitment_communications_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "recruitment_offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "recruitment_communications" ADD CONSTRAINT "recruitment_communications_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "recruitment_email_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "recruitment_communications" ADD CONSTRAINT "recruitment_communications_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "recruitment_communications" ADD CONSTRAINT "recruitment_communications_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "recruitment_communications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "recruitment_communication_attachments" ADD CONSTRAINT "recruitment_communication_attachments_communication_id_fkey" FOREIGN KEY ("communication_id") REFERENCES "recruitment_communications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
