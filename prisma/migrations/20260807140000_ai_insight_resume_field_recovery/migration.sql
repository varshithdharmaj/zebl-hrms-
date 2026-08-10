-- Separate AI insight type for human-reviewed resume field recovery.
-- Must be committed before the value is referenced (PostgreSQL enum rule).
ALTER TYPE "AiInsightType" ADD VALUE IF NOT EXISTS 'resume_field_recovery';
