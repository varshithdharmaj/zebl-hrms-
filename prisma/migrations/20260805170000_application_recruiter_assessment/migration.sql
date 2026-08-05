-- AlterTable
ALTER TABLE "recruitment_applications" ADD COLUMN "assessment" TEXT,
ADD COLUMN "assessment_updated_at" TIMESTAMP(3),
ADD COLUMN "assessment_updated_by_user_id" TEXT;

-- AddForeignKey
ALTER TABLE "recruitment_applications" ADD CONSTRAINT "recruitment_applications_assessment_updated_by_user_id_fkey" FOREIGN KEY ("assessment_updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
