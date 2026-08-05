-- AlterEnum
CREATE TYPE "PreferredWorkMode" AS ENUM ('remote', 'hybrid', 'onsite');

-- AlterTable
ALTER TABLE "candidates"
  ADD COLUMN "professional_summary" TEXT,
  ADD COLUMN "headline" TEXT,
  ADD COLUMN "total_experience_years" DECIMAL(4,1),
  ADD COLUMN "github_url" TEXT,
  ADD COLUMN "preferred_work_mode" "PreferredWorkMode",
  ADD COLUMN "willing_to_relocate" BOOLEAN;
