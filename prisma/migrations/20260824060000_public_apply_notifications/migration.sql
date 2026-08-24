-- P1: candidate confirmation + HR alert notifications for public /apply
-- submissions (Phase-3 hardening, Phases 3-4). Both route through the
-- existing notification queue / GenericNotificationEmail template — no new
-- email provider, no new template system.

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'recruitment_public_application_received';
ALTER TYPE "NotificationType" ADD VALUE 'recruitment_public_application_hr_alert';
