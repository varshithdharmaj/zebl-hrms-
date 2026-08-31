/**
 * Seeds the v1.0 human-readable Leave Policy document (read-only, in-app
 * "Leave Policy" page). Idempotent: does nothing if an active v1.0 document
 * already exists. Never deletes or edits a prior version — historical
 * versions are kept per policy-versioning requirements.
 *
 * Usage: npx tsx prisma/scripts/seed-leave-policy-document.ts
 */
import { PrismaClient } from "@/generated/prisma/client";

const prisma = new PrismaClient();

const CONTENT = `# Company Leave Policy

**Policy Version:** 1.0
**Effective From:** 26 Dec 2025

## Leave Cycle

The leave cycle runs from the 26th of one month to the 25th of the next
(e.g. 26 Dec 2025 – 25 Jan 2026). Monthly leave accounting — such as the
monthly leave limit below — follows this cycle.

## Earned Leave (EL)

- Accrues at 0.5 day per month.
- Monthly accrual begins after the employee completes one year (12 months)
  from their date of joining. No EL is backdated for the waiting period.
- The first accrual lands on the first 26th on or after the one-year
  completion date.
- EL carries forward — unused EL remains available, subject to its expiry.
- Each monthly accrual is valid for 36 months from the date it was granted.
  Oldest EL is used first (FIFO), so unused EL naturally expires in the
  order it was earned.
- EL may be encashed at the time of relieving from the organization, up to
  a maximum of 30 paid days.

## Sick Leave (SL)

- 6 days per year.
- Unused SL does not carry forward — it lapses at the end of the annual
  period (1 Jan – 31 Dec) and does not roll into the next year.
- Sick Leave is independent of the EL one-year eligibility rule and does not
  use the EL 36-month expiry model.
- Sick Leave requests are exempt from the standard advance-notice
  requirement below, since illness is inherently unplanned — at minimum a
  verbal approval from the reporting manager is expected for emergencies.

## Casual Leave (CL)

- 12 days per year.
- New joiners' entitlement is pro-rated based on their date of joining.

## Monthly Leave Limit

- A maximum of 2 leave days may be availed, and approved, per leave cycle
  month under normal circumstances.
- Additional days beyond this limit are Loss of Pay (LOP) — not a leave
  balance, but a payroll consequence of unpaid absence.

## Consecutive Leave

- A maximum of 3 consecutive days of leave can be approved at a time.

## Advance Notice

- Leave requests must normally be submitted at least 1 week (7 days) in
  advance.
- Sick Leave is exempt from this requirement given its emergency nature.

## Loss of Pay (LOP)

LOP represents unpaid absence once applicable paid leave for the month has
been exhausted or the monthly leave limit has been reached. LOP is not
stored as a leave balance and is not something an employee can "apply for"
directly — it is a payroll/attendance consequence calculated from the
underlying leave and attendance records.

## Notes

- No leave will be permitted during an employee's notice period, except for
  very urgent requirements — in which case the notice period is extended by
  the number of days taken.
- A paid holiday falling within a leave period is counted as part of that
  leave, regardless of leave type.
`;

async function main() {
  const existing = await prisma.leavePolicyDocument.findFirst({
    where: { version: "1.0" },
  });
  if (existing) {
    console.log("v1.0 leave policy document already exists (id " + existing.id + "). Nothing to do.");
    return;
  }

  const doc = await prisma.leavePolicyDocument.create({
    data: {
      version: "1.0",
      effectiveFrom: new Date(2025, 11, 26),
      isActive: true,
      content: CONTENT,
    },
  });
  console.log("Created leave policy document v1.0, id", doc.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
