-- AlterTable
-- Tracks server-generated offer letter PDF generation/send actors & timestamps,
-- decoupled from OfferStatus so existing status-gated logic stays untouched.
ALTER TABLE "recruitment_offers"
  ADD COLUMN IF NOT EXISTS "letter_generated_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "letter_generated_by_user_id" TEXT,
  ADD COLUMN IF NOT EXISTS "letter_sent_by_user_id" TEXT;
