-- AlterEnum
-- Add new notification types for ticket system
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ticket_created';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ticket_assigned';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ticket_updated';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ticket_employee_replied';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ticket_status_changed';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ticket_resolved';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ticket_reopened';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ticket_anonymous_created';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ticket_anonymous_updated';
