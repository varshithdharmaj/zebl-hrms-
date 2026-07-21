# Helpdesk Notification Implementation

## Overview

Implemented comprehensive notification system for the Helpdesk / Ticket Raising system, reusing the existing notification architecture with strict security controls for anonymous tickets.

## Files Changed

### Schema Changes

**`prisma/schema.prisma`**
- Extended `NotificationType` enum with 9 new ticket-related values:
  - `ticket_created`
  - `ticket_assigned`
  - `ticket_updated`
  - `ticket_employee_replied`
  - `ticket_status_changed`
  - `ticket_resolved`
  - `ticket_reopened`
  - `ticket_anonymous_created`
  - `ticket_anonymous_updated`

**`prisma/migrations/20260721133500_add_ticket_notification_types/migration.sql`**
- Migration to add new NotificationType enum values to the database

### Notification Logic

**`src/lib/notifications/ticket-notifications.ts`** (NEW)
- `getSuperAdminRecipients()`: Returns only Super Admin users for anonymous ticket notifications
- `getHrRecipientsForTickets()`: Returns HR and Super Admin users for normal ticket notifications
- `getTicketRaiserRecipient()`: Resolves the employee who raised a ticket
- `getTicketHandlerRecipient()`: Resolves the assigned handler for a ticket
- `notifyTicketCreated()`: Sends creation notifications (employee + HR/SA based on anonymity)
- `notifyTicketAssigned()`: Notifies the assigned handler
- `notifyTicketUpdated()`: Notifies employee + SA for anonymous tickets (public updates only)
- `notifyEmployeeReplied()`: Notifies handler or HR pool when employee replies
- `notifyTicketStatusChanged()`: Notifies employee when status changes
- `notifyTicketResolved()`: Notifies employee with resolution notes

### Action Integration

**`src/actions/tickets.ts`**
- Integrated `notifyTicketCreated()` after ticket creation
- Integrated `notifyEmployeeReplied()` after employee reply
- All notifications are async (don't block redirects)

**`src/actions/tickets-admin.ts`**
- Integrated `notifyTicketAssigned()` after ticket assignment
- Integrated `notifyTicketStatusChanged()` after status change
- Integrated `notifyTicketResolved()` for resolved status
- Integrated `notifyTicketUpdated()` after HR adds public updates

### Tests

**`tests/unit/ticket-notification-authorization.test.ts`** (NEW)
- 23 comprehensive tests covering:
  - Recipient resolver functions (Super Admin, HR, employee)
  - Anonymous ticket notification security (SA only)
  - Normal ticket notification distribution (HR + SA)
  - Public update vs internal note handling
  - Employee reply notifications
  - Assignment notifications
  - Status change and resolution notifications
  - Security tests ensuring no information leakage

## Notification Rules

### Employee Notifications

Employees are notified when:
- ✅ Their ticket is created (confirmation)
- ✅ HR adds a public update
- ✅ Ticket is assigned (if relevant to them)
- ✅ Status changes
- ✅ Ticket is resolved
- ✅ Ticket is reopened

Employees are **never** notified about:
- ❌ Internal HR notes
- ❌ Anonymous tickets raised by others

### HR User Notifications

HR users (including Super Admins with HR permissions) are notified when:
- ✅ New normal ticket is created
- ✅ Ticket is assigned to them
- ✅ Employee replies to their assigned ticket
- ✅ Employee replies to unassigned normal ticket (HR pool)
- ✅ Ticket is reopened

HR users are **never** notified about:
- ❌ Anonymous tickets (existence, creation, updates)
- ❌ Anonymous ticket employee replies

### Super Admin Notifications

Super Admins are notified when:
- ✅ Anonymous ticket is created
- ✅ Anonymous ticket is updated (public update)
- ✅ Employee replies to anonymous ticket (unassigned)
- ✅ All normal ticket notifications (as part of HR pool)

Super Admin is the **ONLY** role that receives anonymous ticket notifications.

## Anonymous Ticket Security

### Critical Security Controls

1. **Recipient Filtering**
   - `getSuperAdminRecipients()` explicitly filters for `UserRole.super_admin` only
   - Anonymous tickets use separate notification types (`ticket_anonymous_created`, `ticket_anonymous_updated`)
   - HR users are **never** included in anonymous ticket notification recipients

2. **Information Sanitization**
   - Anonymous ticket notifications to SA do **not** include:
     - Employee identity
     - Employee ID
     - Detailed subject/description
   - Notifications use generic messages: "A new anonymous ticket requires Super Admin attention."
   - Ticket number is included for SA to access full details via secure interface

3. **Notification Type Separation**
   - Normal tickets: `ticket_created`, `ticket_updated`, `ticket_employee_replied`
   - Anonymous tickets: `ticket_anonymous_created`, `ticket_anonymous_updated`
   - This prevents accidental exposure via notification routing

4. **Public Update Filtering**
   - Only `public_update` visibility triggers employee notifications
   - `internal_note` messages **never** trigger employee notifications
   - Anonymous ticket updates notify both employee (raiser) and SA

## Testing Coverage

All 23 tests pass, covering:

1. **Recipient Authorization** (5 tests)
   - Super Admin recipient filtering
   - HR recipient filtering
   - Role exclusion verification

2. **Anonymous Ticket Notifications** (8 tests)
   - SA-only notification delivery
   - HR exclusion verification
   - Information leakage prevention
   - Employee identity protection
   - Subject/category sanitization

3. **Normal Ticket Notifications** (5 tests)
   - HR pool notification
   - Subject inclusion for normal tickets
   - Employee notification
   - Assigned handler notification

4. **Action-Specific Notifications** (5 tests)
   - Assignment notifications
   - Status change notifications
   - Resolution notifications
   - Employee reply routing

## Migration Requirements

### Database Migration

**Migration file:** `prisma/migrations/20260721133500_add_ticket_notification_types/migration.sql`

**Action required:**
```bash
# Apply migration to database
npx prisma migrate deploy

# Regenerate Prisma client
npx prisma generate
```

**Migration strategy:**
- Uses `ADD VALUE IF NOT EXISTS` for safe idempotent execution
- No data loss or downtime
- Adds enum values only; no table changes

## Security Verification Checklist

- [x] Anonymous tickets notify **only** Super Admin
- [x] HR users receive **zero** anonymous ticket notifications
- [x] Employee identity is **never** included in anonymous notifications
- [x] Anonymous ticket subject is **never** exposed to unauthorized users
- [x] Ticket number alone does not leak information (SA-only access enforced)
- [x] Internal notes **never** trigger employee notifications
- [x] Notification recipient resolution enforces role-based authorization
- [x] All notification functions are async (non-blocking)
- [x] Rate limiting is inherited from existing notification queue
- [x] Audit logging is maintained for all ticket events

## Integration Points

### Notification Queue
- Reuses `enqueueNotification()` from existing system
- Inherits rate limiting (60s window by default)
- Inherits retry logic (max attempts)
- Inherits delivery status tracking

### Audit Logging
- Notifications queued after audit log write
- Correlation ID matches ticket ID
- Notification failures logged to console (non-blocking)

### Recipient Resolution
- Follows existing patterns (`getHrRecipients`, `getEmployeeUserEmail`)
- Handles users without employee records gracefully
- Sanitizes email addresses using existing helper

## Error Handling

All notification calls are wrapped in `.catch()` blocks:
- Errors logged to console with `[zebl]` prefix
- Never block ticket operations
- User sees success even if notification fails
- Background retry through notification queue

## Performance Considerations

1. **Async Execution**: All notifications are fire-and-forget
2. **Rate Limiting**: Prevents notification spam per ticket/recipient
3. **Batch Queries**: HR recipients fetched once per ticket event
4. **Conditional Logic**: Anonymous check prevents unnecessary HR queries

## Future Enhancements

Potential improvements (not currently implemented):
- Notification preferences per user
- In-app notification center
- SMS/push notifications for high-priority tickets
- Digest emails for bulk ticket updates
- Escalation reminders for unresolved tickets

## References

- Notification Queue: `src/lib/notifications/notification-queue.ts`
- Recipient Resolver: `src/lib/notifications/recipient-resolver.ts`
- Notification Types: `prisma/schema.prisma` (NotificationType enum)
- Audit Actions: `src/lib/audit.ts`
