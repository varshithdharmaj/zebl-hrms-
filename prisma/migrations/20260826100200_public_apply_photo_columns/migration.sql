-- AlterTable
-- Adds passport-photo intake columns to public_application_submissions,
-- mirroring the existing resume_* columns' temp-storage lifecycle.
ALTER TABLE "public_application_submissions"
  ADD COLUMN IF NOT EXISTS "photo_file_name" TEXT,
  ADD COLUMN IF NOT EXISTS "photo_mime_type" TEXT,
  ADD COLUMN IF NOT EXISTS "photo_size_bytes" INTEGER,
  ADD COLUMN IF NOT EXISTS "photo_storage_key" TEXT,
  ADD COLUMN IF NOT EXISTS "photo_checksum" TEXT;
