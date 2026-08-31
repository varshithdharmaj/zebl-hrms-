-- Partial unique index: at most one primary photo per candidate.
-- Mirrors "candidate_documents_one_primary_resume" from the recruitment
-- foundation migration (Prisma cannot express partial unique indexes).
CREATE UNIQUE INDEX IF NOT EXISTS "candidate_documents_one_primary_photo"
  ON "candidate_documents" ("candidate_id")
  WHERE "document_type" = 'photo'
    AND "is_primary" = true
    AND "deleted_at" IS NULL;
