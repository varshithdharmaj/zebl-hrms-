-- CreateEnum
CREATE TYPE "TicketCategory" AS ENUM ('attendance', 'leave', 'payroll', 'salary', 'it_technical', 'hr', 'workplace', 'facilities', 'suggestion', 'other');

-- CreateEnum
CREATE TYPE "TicketType" AS ENUM ('complaint', 'service_request', 'suggestion', 'meeting_request', 'anonymous_complaint', 'other');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('new', 'open', 'in_progress', 'waiting_for_employee', 'on_hold', 'resolved', 'closed', 'canceled');

-- CreateEnum
CREATE TYPE "TicketMessageVisibility" AS ENUM ('public_update', 'internal_note', 'employee_reply');

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "ticket_number" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "TicketCategory" NOT NULL,
    "type" "TicketType" NOT NULL,
    "priority" "TicketPriority" NOT NULL DEFAULT 'medium',
    "status" "TicketStatus" NOT NULL DEFAULT 'new',
    "is_anonymous" BOOLEAN NOT NULL DEFAULT false,
    "raised_by_employee_id" INTEGER NOT NULL,
    "department" TEXT,
    "assigned_to_user_id" TEXT,
    "resolution_notes" TEXT,
    "resolved_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_messages" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "visibility" "TicketMessageVisibility" NOT NULL,
    "body" TEXT NOT NULL,
    "author_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_history" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "field_changed" TEXT,
    "old_value" TEXT,
    "new_value" TEXT,
    "actor_user_id" TEXT NOT NULL,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tickets_ticket_number_key" ON "tickets"("ticket_number");

-- CreateIndex
CREATE INDEX "tickets_ticket_number_idx" ON "tickets"("ticket_number");

-- CreateIndex
CREATE INDEX "tickets_status_idx" ON "tickets"("status");

-- CreateIndex
CREATE INDEX "tickets_priority_idx" ON "tickets"("priority");

-- CreateIndex
CREATE INDEX "tickets_category_idx" ON "tickets"("category");

-- CreateIndex
CREATE INDEX "tickets_raised_by_employee_id_idx" ON "tickets"("raised_by_employee_id");

-- CreateIndex
CREATE INDEX "tickets_assigned_to_user_id_idx" ON "tickets"("assigned_to_user_id");

-- CreateIndex
CREATE INDEX "tickets_is_anonymous_idx" ON "tickets"("is_anonymous");

-- CreateIndex
CREATE INDEX "tickets_created_at_idx" ON "tickets"("created_at");

-- CreateIndex
CREATE INDEX "tickets_status_is_anonymous_idx" ON "tickets"("status", "is_anonymous");

-- CreateIndex
CREATE INDEX "tickets_assigned_to_user_id_status_idx" ON "tickets"("assigned_to_user_id", "status");

-- CreateIndex
CREATE INDEX "ticket_messages_ticket_id_idx" ON "ticket_messages"("ticket_id");

-- CreateIndex
CREATE INDEX "ticket_messages_ticket_id_created_at_idx" ON "ticket_messages"("ticket_id", "created_at");

-- CreateIndex
CREATE INDEX "ticket_messages_author_user_id_idx" ON "ticket_messages"("author_user_id");

-- CreateIndex
CREATE INDEX "ticket_history_ticket_id_idx" ON "ticket_history"("ticket_id");

-- CreateIndex
CREATE INDEX "ticket_history_ticket_id_created_at_idx" ON "ticket_history"("ticket_id", "created_at");

-- CreateIndex
CREATE INDEX "ticket_history_action_idx" ON "ticket_history"("action");

-- CreateIndex
CREATE INDEX "ticket_history_actor_user_id_idx" ON "ticket_history"("actor_user_id");

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_raised_by_employee_id_fkey" FOREIGN KEY ("raised_by_employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assigned_to_user_id_fkey" FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_history" ADD CONSTRAINT "ticket_history_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_history" ADD CONSTRAINT "ticket_history_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
