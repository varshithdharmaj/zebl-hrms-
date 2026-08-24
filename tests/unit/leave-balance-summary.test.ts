import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildLeaveBalanceSummariesFromParts } from "@/lib/leave";

const joiningEligible = new Date("2018-01-01");
const eligibleInfo = { eligible: true, eligibilityDate: joiningEligible };

function byType(
  summaries: ReturnType<typeof buildLeaveBalanceSummariesFromParts>,
  leaveType: "EL" | "CL" | "SL"
) {
  const row = summaries.find((s) => s.leaveType === leaveType);
  if (!row) throw new Error(`Missing ${leaveType}`);
  return row;
}

describe("buildLeaveBalanceSummariesFromParts — authoritative remaining math", () => {
  it("Case 1 — no leave used: remaining equals balance row, used is 0", () => {
    const summaries = buildLeaveBalanceSummariesFromParts(
      eligibleInfo,
      { elBalance: 20, clBalance: 12, slBalance: 12 },
      [
        { leaveType: "CL", transactionType: "accrual", _sum: { amount: 12 } },
        { leaveType: "SL", transactionType: "accrual", _sum: { amount: 12 } },
        { leaveType: "EL", transactionType: "accrual", _sum: { amount: 20 } },
      ],
      []
    );

    expect(byType(summaries, "CL")).toMatchObject({ remaining: 12, used: 0, total: 12 });
    expect(byType(summaries, "SL")).toMatchObject({ remaining: 12, used: 0, total: 12 });
    expect(byType(summaries, "EL")).toMatchObject({ remaining: 20, used: 0, total: 20 });
  });

  it("Case 2 — approved leave (deduction): used increases, remaining comes from balance row", () => {
    // Entitlement 20, approved deduction 5 → remaining 15 stored on balance row
    const summaries = buildLeaveBalanceSummariesFromParts(
      eligibleInfo,
      { elBalance: 15, clBalance: 0, slBalance: 0 },
      [
        { leaveType: "EL", transactionType: "accrual", _sum: { amount: 20 } },
        { leaveType: "EL", transactionType: "deduction", _sum: { amount: 5 } },
      ],
      []
    );

    const el = byType(summaries, "EL");
    expect(el.remaining).toBe(15);
    expect(el.used).toBe(5);
    expect(el.total).toBe(20);
  });

  it("Case 3 — pending leave: no deduction transaction, remaining unchanged", () => {
    // Pending requests never write LeaveTransaction deductions; balance row is unchanged.
    const summaries = buildLeaveBalanceSummariesFromParts(
      eligibleInfo,
      { elBalance: 20, clBalance: 12, slBalance: 12 },
      [
        { leaveType: "CL", transactionType: "accrual", _sum: { amount: 12 } },
        { leaveType: "SL", transactionType: "accrual", _sum: { amount: 12 } },
        { leaveType: "EL", transactionType: "accrual", _sum: { amount: 20 } },
      ],
      []
    );

    expect(byType(summaries, "EL").remaining).toBe(20);
    expect(byType(summaries, "EL").used).toBe(0);
  });

  it("Case 4 — rejected/cancelled-before-approval: no deduction, remaining unchanged", () => {
    // Reject / withdraw before final approval do not create deduction txs.
    const summaries = buildLeaveBalanceSummariesFromParts(
      eligibleInfo,
      { elBalance: 10, clBalance: 8, slBalance: 9 },
      [
        { leaveType: "EL", transactionType: "accrual", _sum: { amount: 10 } },
        { leaveType: "CL", transactionType: "accrual", _sum: { amount: 8 } },
        { leaveType: "SL", transactionType: "accrual", _sum: { amount: 9 } },
      ],
      []
    );

    expect(byType(summaries, "EL").remaining).toBe(10);
    expect(byType(summaries, "CL").remaining).toBe(8);
    expect(byType(summaries, "SL").remaining).toBe(9);
    expect(byType(summaries, "EL").used).toBe(0);
  });

  it("Case 5 — fractional (EL monthly 0.5) balances are preserved", () => {
    // Product has no half-day leave requests; EL accrues 0.5/month. Fractional remaining must round-trip.
    const summaries = buildLeaveBalanceSummariesFromParts(
      eligibleInfo,
      { elBalance: 3.5, clBalance: 0, slBalance: 0 },
      [
        { leaveType: "EL", transactionType: "accrual", _sum: { amount: 4 } },
        { leaveType: "EL", transactionType: "deduction", _sum: { amount: 0.5 } },
      ],
      []
    );

    const el = byType(summaries, "EL");
    expect(el.remaining).toBe(3.5);
    expect(el.used).toBe(0.5);
    expect(el.total).toBe(4);
  });

  it("Case 6 — cancellation restore is an accrual credit (remaining restored)", () => {
    // Cancel of approved leave posts a restore accrual; remaining reflects the credit on the balance row.
    // Note: used still counts the original deduction (ledger design).
    const summaries = buildLeaveBalanceSummariesFromParts(
      eligibleInfo,
      { elBalance: 20, clBalance: 0, slBalance: 0 },
      [
        { leaveType: "EL", transactionType: "accrual", _sum: { amount: 25 } }, // 20 entitlement + 5 restore
        { leaveType: "EL", transactionType: "deduction", _sum: { amount: 5 } },
      ],
      []
    );

    const el = byType(summaries, "EL");
    expect(el.remaining).toBe(20);
    expect(el.used).toBe(5);
    expect(el.total).toBe(25);
  });

  it("Case 7 — each leave type is calculated independently", () => {
    const summaries = buildLeaveBalanceSummariesFromParts(
      eligibleInfo,
      { elBalance: 4, clBalance: 10, slBalance: 7 },
      [
        { leaveType: "EL", transactionType: "accrual", _sum: { amount: 6 } },
        { leaveType: "EL", transactionType: "deduction", _sum: { amount: 2 } },
        { leaveType: "CL", transactionType: "accrual", _sum: { amount: 12 } },
        { leaveType: "CL", transactionType: "deduction", _sum: { amount: 2 } },
        { leaveType: "SL", transactionType: "accrual", _sum: { amount: 12 } },
        { leaveType: "SL", transactionType: "deduction", _sum: { amount: 5 } },
      ],
      []
    );

    expect(byType(summaries, "EL")).toMatchObject({ remaining: 4, used: 2, total: 6 });
    expect(byType(summaries, "CL")).toMatchObject({ remaining: 10, used: 2, total: 12 });
    expect(byType(summaries, "SL")).toMatchObject({ remaining: 7, used: 5, total: 12 });
  });

  it("negative manual adjustments count toward used; positive toward accrued/total fallback", () => {
    const summaries = buildLeaveBalanceSummariesFromParts(
      eligibleInfo,
      { elBalance: 0, clBalance: 9.5, slBalance: 0 },
      [{ leaveType: "CL", transactionType: "accrual", _sum: { amount: 12 } }],
      [
        { leaveType: "CL", amount: -2 },
        { leaveType: "CL", amount: -0.5 },
      ]
    );

    const cl = byType(summaries, "CL");
    expect(cl.remaining).toBe(9.5);
    expect(cl.used).toBe(2.5);
    expect(cl.total).toBe(12);
  });
});

describe("Case 8 — Dashboard vs Leave page source-of-truth alignment", () => {
  it("both employee surfaces request processAccruals: true", () => {
    const root = join(process.cwd(), "src");
    const dashboard = readFileSync(
      join(root, "components/employee/employee-dashboard.tsx"),
      "utf8"
    );
    const leavePageData = readFileSync(join(root, "lib/data/leaves.ts"), "utf8");

    const accrualCall =
      /getLeaveBalanceSummaries\(\s*employeeId\s*,\s*\{\s*processAccruals:\s*true\s*\}\s*\)/;

    expect(dashboard).toMatch(accrualCall);
    expect(leavePageData).toMatch(accrualCall);
    expect(dashboard).not.toMatch(/processAccruals:\s*false/);
  });
});

describe("Case 9 — Single-employee surfaces use authoritative processAccruals: true", () => {
  it("manager detail, approval enrichment, and token page request processAccruals: true", () => {
    const root = join(process.cwd(), "src");
    const managerDetail = readFileSync(
      join(root, "lib/manager/team-people-query.ts"),
      "utf8"
    );
    const pendingApprovals = readFileSync(
      join(root, "lib/workflow/pending-approvals.ts"),
      "utf8"
    );
    const tokenValidator = readFileSync(
      join(root, "lib/approval-tokens/token-validator.ts"),
      "utf8"
    );

    expect(managerDetail).toMatch(
      /getLeaveBalanceSummaries\(\s*subjectEmployeeId\s*,\s*\{\s*processAccruals:\s*true\s*\}\s*\)/
    );
    expect(managerDetail).not.toMatch(/processAccruals:\s*false/);

    expect(pendingApprovals).toMatch(/processAccruals:\s*true/);
    expect(pendingApprovals).not.toMatch(/processAccruals:\s*false/);

    expect(tokenValidator).toMatch(
      /getLeaveBalanceSummaries\(\s*record\.leaveRequest\.employeeId\s*,\s*\{\s*processAccruals:\s*true,?\s*\}\s*\)/s
    );
  });

  it("bulk overview helpers remain processAccruals:false semantics", () => {
    const leaveLib = readFileSync(join(process.cwd(), "src/lib/leave.ts"), "utf8");
    expect(leaveLib).toMatch(
      /Uses processAccruals:false semantics \(no accrual processing\)/
    );
  });
});
