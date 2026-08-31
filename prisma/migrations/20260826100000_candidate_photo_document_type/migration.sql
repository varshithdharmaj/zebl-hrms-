-- AlterEnum
-- Adds "photo" as a candidate document type (passport-size photo uploads).
-- Split into its own migration: a new enum value cannot be referenced
-- (e.g. in an index predicate) within the same transaction that adds it.
ALTER TYPE "RecruitmentDocumentType" ADD VALUE IF NOT EXISTS 'photo';
