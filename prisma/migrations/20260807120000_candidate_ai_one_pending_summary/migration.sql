-- At most one pending candidate_summary insight per candidate (concurrency safety).
-- Accepted/dismissed/superseded history remains unbounded.
CREATE UNIQUE INDEX IF NOT EXISTS "candidate_ai_insights_one_pending_summary_uidx"
  ON "candidate_ai_insights" ("candidate_id")
  WHERE "insight_type" = 'candidate_summary' AND "status" = 'pending_review';
