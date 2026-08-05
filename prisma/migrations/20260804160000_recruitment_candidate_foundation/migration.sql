-- AlterEnum
ALTER TYPE "CandidateSource" ADD VALUE 'manual';
ALTER TYPE "CandidateSource" ADD VALUE 'import';
ALTER TYPE "CandidateSource" ADD VALUE 'employee_referral';
ALTER TYPE "CandidateSource" ADD VALUE 'career_portal_future';

-- AlterEnum
ALTER TYPE "CandidateStatus" ADD VALUE 'merged';

-- AlterTable
ALTER TABLE "candidate_certifications" ADD COLUMN     "credential_url" TEXT,
ADD COLUMN     "expiry_date" TIMESTAMP(3),
ADD COLUMN     "issue_date" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "candidate_documents" ADD COLUMN     "file_type" TEXT,
ADD COLUMN     "size" INTEGER,
ADD COLUMN     "storage_path" TEXT;

-- AlterTable
ALTER TABLE "candidate_educations" ADD COLUMN     "field_of_study" TEXT,
ADD COLUMN     "grade" TEXT;

-- AlterTable
ALTER TABLE "candidate_experiences" ADD COLUMN     "company_name" TEXT,
ADD COLUMN     "currently_working" BOOLEAN DEFAULT false,
ADD COLUMN     "designation" TEXT,
ADD COLUMN     "employment_type" TEXT;

-- AlterTable
ALTER TABLE "candidate_notes" ADD COLUMN     "content" TEXT;

-- AlterTable
ALTER TABLE "candidate_projects" ADD COLUMN     "description" TEXT,
ADD COLUMN     "duration" TEXT,
ADD COLUMN     "role" TEXT,
ADD COLUMN     "technologies" TEXT;

-- AlterTable
ALTER TABLE "candidate_skills" ADD COLUMN     "skill_name" TEXT,
ADD COLUMN     "years_of_experience" INTEGER;

-- AlterTable
ALTER TABLE "candidates" ADD COLUMN     "archived_at" TIMESTAMP(3),
ADD COLUMN     "date_of_birth" TIMESTAMP(3),
ADD COLUMN     "first_name" TEXT,
ADD COLUMN     "last_name" TEXT,
ADD COLUMN     "normalized_email" TEXT,
ADD COLUMN     "normalized_phone" TEXT,
ADD COLUMN     "tenant_id" TEXT;

-- CreateTable
CREATE TABLE "candidate_personal" (
    "candidate_id" TEXT NOT NULL,
    "nationality" TEXT,
    "current_location" TEXT,
    "preferred_location" TEXT,
    "notice_period" TEXT,
    "availability_date" TIMESTAMP(3),
    "linkedin_url" TEXT,
    "portfolio_url" TEXT,

    CONSTRAINT "candidate_personal_pkey" PRIMARY KEY ("candidate_id")
);

-- CreateIndex
CREATE INDEX "candidates_tenant_id_idx" ON "candidates"("tenant_id");

-- CreateIndex
CREATE INDEX "candidates_normalized_email_idx" ON "candidates"("normalized_email");

-- CreateIndex
CREATE INDEX "candidates_normalized_phone_idx" ON "candidates"("normalized_phone");

-- AddForeignKey
ALTER TABLE "candidate_personal" ADD CONSTRAINT "candidate_personal_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
