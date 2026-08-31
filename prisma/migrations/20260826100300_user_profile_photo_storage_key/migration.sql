-- AlterTable
-- Backing storage key for real uploaded profile photos. "profile_photo_url"
-- keeps rendering as-is (SSO URL, or our own serve route once uploaded).
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "profile_photo_storage_key" TEXT;
