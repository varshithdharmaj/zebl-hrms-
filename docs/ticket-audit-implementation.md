# Helpdesk Audit History Implementation

## Overview

Implemented comprehensive audit logging and history tracking for the Helpdesk/Ticket system, reusing the existing audit infrastructure with strict authorization controls for anonymous tickets.

## Implementation Summary

### Files Created

**Audit Logic:**
- `src/lib/audit/ticket-audit.ts` - Core audit history retrieval with authorization

**UI Components:**
- `src/components/tickets/ticket-audit-history.tsx` - Audit history display component

**Tests:**
- `tests/unit/ticket-audit-visibility.test.ts` - 25 comprehensive tests for audit visibility

### Files Modified

**Core Audit System:**
- `src/lib/audit.ts` - Added 17 ticket-specific audit action constants

**Actions:**
- `src/actions/tickets.ts` - Updated to use audit constants, capture message IDs
- `src/actions/tickets-admin.ts` - Updated to use audit constants, capture message IDs

**UI Pages:**
- `src/app/(dashboard)/employee/tickets/[id]/page.tsx` - Integrated audit history display
- `src/app/(dashboard)/admin/tickets/[id]/page.tsx` - Integrated audit history display

## Audit Actions Tracked

### Ticket Lifecycle
- `TICKET_CREATED` - Normal ticket created
- `TICKET_CREATED_ANONYMOUS` - Anonymous ticket created
- `TICKET_UPDATED` - Ticket fields updated
- `TICKET_RESOLVED` - Ticket resolved
- `TICKET_REOPENED` - Ticket reopened
- `TICKET_CLOSED` - Ticket closed
- `TICKET_CANCELED` - Ticket canceled

### Status & Assignment
- `TICKET_STATUS_CHANGED` - Status updated (general)
- `TICKET_ASSIGNED` - Handler assigned/reassigned
- `TICKET_PRIORITY_CHANGED` - Priority changed

### Communication
- `TICKET_HR_UPDATE_ADDED` - HR added public update
- `TICKET_INTERNAL_NOTE_ADDED` - HR added internal note
- `TICKET_EMPLOYEE_REPLY_ADDED` - Employee replied

### Attachments (Future)
- `TICKET_ATTACHMENT_UPLOADED` - Attachment added (reserved for future use)

## Security Model

### Authorization Rules

**Employee Access:**
- Can view audit history for their own normal tickets
- **Cannot** view audit history for other employees' tickets
- **Cannot** view audit history for their own anonymous tickets
- Audit metadata always captures actual employee ID for compliance

**HR Access:**
- Can view audit history for tickets assigned to them
- Can view audit history for tickets in their department
- **Cannot** view audit history for anonymous tickets
- **Cannot** view audit history for unassigned tickets outside their department

**Super Admin Access:**
- Can view audit history for **all** tickets including anonymous
- Full access to all metadata including employee identity in anonymous tickets
- Audit history includes "Super Admin Only" label for anonymous tickets

### Anonymous Ticket Audit Preservation

**Critical Requirements Met:**
1. Actual employee identity **IS** preserved in audit metadata for compliance
2. Non-Super Admin users **CANNOT** view anonymous ticket audit history
3. Audit logs **DO NOT** leak through normal HR queries
4. Authorization is enforced at the query level, not just UI

**Example Audit Record (Anonymous Ticket):**
```json
{
  "action": "ticket.created.anonymous",
  "metadata": {
    "ticketNumber": "TKT-ANON-001",
    "category": "workplace",
    "type": "anonymous_complaint",
    "priority": "high",
    "isAnonymous": true,
    "raisedByEmployeeId": 42  // Preserved for SA/compliance
  }
}
```

## Implementation Details

### Audit History Retrieval

**Function:** `getTicketAuditHistory(ticketId, session)`
- Fetches ticket to verify authorization
- Checks `canViewTicket(session, ticket)`
- For anonymous tickets, requires `isSuperAdmin(session.role)`
- Returns empty array if unauthorized (no 403, silent failure)
- Orders by `createdAt DESC` (most recent first)

**Function:** `canViewTicketAuditHistory(ticketId, session)`
- Permission check without fetching full audit history
- Used for conditional UI rendering
- Same authorization rules as `getTicketAuditHistory`

**Function:** `getTicketAuditSummary(ticketId, session, limit=5)`
- Returns last N audit events for quick display
- Used for ticket detail page summaries
- Same authorization rules apply

**Function:** `formatAuditAction(action)`
- Converts audit action to human-readable format
- Examples:
  - `ticket.created` → "Created"
  - `ticket.status.changed` → "Status Changed"
  - `ticket.internal_note.added` → "Internal Note Added"

### UI Component

**`TicketAuditHistory` Component:**
- Displays audit events in collapsible table
- Shows timestamp, action, actor, details
- Expandable (show all / show less for >5 events)
- Visual indicators:
  - 🎫 Created
  - 👤 Assigned
  - 📊 Status changed
  - ✅ Resolved
  - 🔄 Reopened
  - 💬 Reply
  - 📝 Update
  - 🔒 Internal note
  - ⚡ Priority changed
  - ❌ Canceled

**Anonymous Ticket Indicator:**
- Shows "Super Admin Only" label for SA viewing anonymous tickets
- Red warning banner on anonymous ticket audit history
- Clear visual distinction from normal ticket audit

### Metadata Captured

**Ticket Creation:**
- `ticketNumber`
- `category`, `type`, `priority`
- `isAnonymous`
- `raisedByEmployeeId` (preserved for all tickets)

**Assignment:**
- `assignedToUserId` (new)
- `previousAssignedToUserId` (old)

**Status Change:**
- `oldStatus`
- `newStatus`
- `hasResolutionNotes` (boolean)

**Messages:**
- `messageId`
- `visibility` (for HR updates/internal notes)

## Test Coverage

**145 Total Ticket Tests Passed:**
- 52 tests: General ticket authorization
- 45 tests: Anonymous ticket access control
- 23 tests: Notification recipient authorization
- 25 tests: **Audit history visibility** (NEW)

### Audit Visibility Tests

**Authorization Tests (16 tests):**
- Employee can view own normal ticket audit
- Employee cannot view other employee's ticket audit
- Employee cannot view own anonymous ticket audit
- HR can view assigned ticket audit
- HR cannot view anonymous ticket audit
- Super Admin can view all ticket audit including anonymous

**Functional Tests (4 tests):**
- Audit summary returns limited entries
- Audit summary respects authorization
- Format audit action correctly
- Query filtering works properly

**Security Tests (5 tests):**
- Anonymous ticket metadata preserves employee identity
- Employee identity not exposed through queries
- HR cannot access anonymous audit via any method
- Super Admin sees complete audit trail
- Audit query constructs proper WHERE clause

## Integration

### Action Layer

All ticket actions now use `AUDIT_ACTIONS` constants:
```typescript
await writeAuditLog({
  entityType: "ticket",
  entityId: ticket.id,
  action: AUDIT_ACTIONS.TICKET_CREATED,
  actorUserId: session.id,
  actorEmail: session.email,
  metadata: { ticketNumber, category, ... },
});
```

### UI Layer

Ticket detail pages now include audit history:
```tsx
<TicketAuditHistory
  auditLogs={auditLogs}
  isAnonymous={ticket.isAnonymous}
  isSuperAdmin={isSuperAdmin(session.role)}
/>
```

## Usage Examples

### Query Audit History (Server-Side)

```typescript
import { getTicketAuditHistory } from "@/lib/audit/ticket-audit";

const auditLogs = await getTicketAuditHistory(ticketId, session);
// Returns [] if unauthorized, audit logs if authorized
```

### Check Permission (Server-Side)

```typescript
import { canViewTicketAuditHistory } from "@/lib/audit/ticket-audit";

const canView = await canViewTicketAuditHistory(ticketId, session);
// Returns boolean
```

### Display Audit History (Client-Side)

```tsx
<TicketAuditHistory
  auditLogs={auditLogs}
  isAnonymous={ticket.isAnonymous}
  isSuperAdmin={isSuperAdmin(session.role)}
/>
```

## Performance Considerations

**Database Queries:**
- Single `findUnique` for ticket authorization
- Single `findMany` for audit logs (indexed on `entityType` + `entityId`)
- No N+1 queries
- Authorization check happens before audit fetch (fail fast)

**Query Optimization:**
- `@@index([entityType, entityId])` on `AuditLog` table
- Orders by `createdAt DESC` for recent-first display
- Limits applied via `slice()` on client for summaries

**UI Performance:**
- Expandable component (only renders 5 initially)
- Metadata formatting happens client-side
- No real-time updates (static server-rendered data)

## Compliance & Audit Requirements

### What's Preserved

1. **Employee Identity:** Always captured in `metadata.raisedByEmployeeId` for all tickets
2. **Actor Information:** `actorUserId` and `actorEmail` for every action
3. **Timestamps:** `createdAt` for every audit entry
4. **Action Details:** Rich metadata for status changes, assignments, etc.
5. **Immutability:** Audit logs are append-only, never modified

### What's Protected

1. **Anonymous Ticket Audit:** Only accessible to Super Admin
2. **Internal Notes:** Marked in audit but content not duplicated
3. **Authorization History:** Cannot bypass via direct audit queries
4. **Information Leakage:** Empty array returned for unauthorized access (no error hints)

### Compliance Use Cases

- **Investigation:** Super Admin can trace full ticket lifecycle
- **Accountability:** All actions attributed to specific users
- **Audit Trail:** Complete history for regulatory requirements
- **Anonymous Handling:** Employee identity preserved for legal/HR investigations
- **Access Logs:** Can see who accessed/modified what and when

## Future Enhancements

Potential improvements (not currently implemented):
- Audit log retention policies
- Audit log export to external systems
- Real-time audit log streaming
- Advanced audit search/filtering
- Audit log archival
- Audit log analytics dashboard
- Automated audit alerts for suspicious activity

## References

- Audit System: `src/lib/audit.ts`
- Audit Queries: `src/lib/audit/audit-queries.ts`
- Ticket Permissions: `src/lib/tickets/ticket-permissions.ts`
- Ticket Access: `src/lib/tickets/ticket-access.ts`
