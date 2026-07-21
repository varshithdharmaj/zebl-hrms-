-- Add missing composite indexes for performance optimization
-- These indexes cover common query patterns in the Helpdesk system

-- Employee filtering by status
CREATE INDEX IF NOT EXISTS "tickets_raised_by_employee_id_status_idx" 
ON "tickets" ("raised_by_employee_id", "status");

-- Anonymous ticket filtering with priority
CREATE INDEX IF NOT EXISTS "tickets_is_anonymous_status_priority_idx" 
ON "tickets" ("is_anonymous", "status", "priority");

-- Time-based queries with anonymous filtering
CREATE INDEX IF NOT EXISTS "tickets_created_at_is_anonymous_idx" 
ON "tickets" ("created_at" DESC, "is_anonymous");

-- Department-based HR queries
CREATE INDEX IF NOT EXISTS "tickets_department_status_idx" 
ON "tickets" ("department", "status") WHERE "department" IS NOT NULL;

-- Category filtering with anonymous check
CREATE INDEX IF NOT EXISTS "tickets_category_is_anonymous_idx" 
ON "tickets" ("category", "is_anonymous");
