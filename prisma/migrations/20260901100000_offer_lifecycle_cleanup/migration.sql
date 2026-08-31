-- Closes drift between schema.prisma (already trimmed to draft/released/accepted/
-- declined/withdrawn, with structured decline_reason/withdraw_reason) and the live
-- database, which was still on the original 7-value OfferStatus enum with the dead
-- manager_approval/hr_approval columns/states, and never had offer_number_seq.

-- 1. Offer number sequence (start at 1000)
CREATE SEQUENCE IF NOT EXISTS offer_number_seq START WITH 1000;

-- 2. Structured lifecycle reason columns
ALTER TABLE "recruitment_offers" ADD COLUMN IF NOT EXISTS "decline_reason" TEXT;
ALTER TABLE "recruitment_offers" ADD COLUMN IF NOT EXISTS "withdraw_reason" TEXT;

-- 3. Backfill any null offer_number, then enforce uniqueness/required
UPDATE "recruitment_offers"
SET "offer_number" = 'OFFER-' || EXTRACT(YEAR FROM "created_at") || '-' || LPAD(nextval('offer_number_seq')::text, 5, '0')
WHERE "offer_number" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "recruitment_offers_offer_number_key" ON "recruitment_offers"("offer_number");
ALTER TABLE "recruitment_offers" ALTER COLUMN "offer_number" SET NOT NULL;

-- 4. Drop dead approval columns (no longer declared on Offer in schema.prisma)
ALTER TABLE "recruitment_offers"
  DROP COLUMN IF EXISTS "manager_approval_skipped",
  DROP COLUMN IF EXISTS "manager_approved_by_user_id",
  DROP COLUMN IF EXISTS "manager_approved_at",
  DROP COLUMN IF EXISTS "hr_approved_by_user_id",
  DROP COLUMN IF EXISTS "hr_approved_at";

-- 5. Collapse OfferStatus to 5 values — Postgres cannot drop enum values in place,
-- so any row still sitting in a dead approval state is moved to draft first.
UPDATE "recruitment_offers" SET "status" = 'draft' WHERE "status" IN ('manager_approval', 'hr_approval');

ALTER TYPE "OfferStatus" RENAME TO "OfferStatus_old";
CREATE TYPE "OfferStatus" AS ENUM ('draft', 'released', 'accepted', 'declined', 'withdrawn');
ALTER TABLE "recruitment_offers"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "OfferStatus" USING ("status"::text::"OfferStatus"),
  ALTER COLUMN "status" SET DEFAULT 'draft';
DROP TYPE "OfferStatus_old";
