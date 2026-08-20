import { describe, expect, it } from "vitest";
import {
  resolveActiveMonthKey,
  nextPinnedMonthKey,
  shouldClearHoverOnFocusOut,
} from "@/components/employee/dashboard/attendance-heatmap";

/**
 * These tests exercise the pure state-derivation helpers that drive
 * AttendanceHeatmap's month-summary interaction model. The repo's vitest
 * setup runs in the "node" environment (no jsdom/@testing-library/react),
 * so the interaction invariant is verified at the state-transition level
 * rather than via full component rendering — matching how the rest of this
 * heatmap module is tested (getCellColor, buildTooltipText, etc. in
 * attendance-heatmap-cell.test.ts).
 */

// Minimal stand-in for a DOM Node, satisfying the `contains` contract used
// by shouldClearHoverOnFocusOut without pulling in jsdom.
function fakeContainer(childOrSelfIds: Set<unknown>): { contains(node: unknown): boolean } {
  return {
    contains(node: unknown) {
      return node != null && childOrSelfIds.has(node);
    },
  };
}

describe("resolveActiveMonthKey", () => {
  // TEST 1 — pinned month vs different hovered month
  it("shows the actively hovered month, not the pinned month, when they differ", () => {
    const pinnedMonthKey = "2026-05"; // Month A pinned
    const hoveredMonthKey = "2026-06"; // Month B hovered

    expect(resolveActiveMonthKey(hoveredMonthKey, pinnedMonthKey)).toBe("2026-06");
    expect(resolveActiveMonthKey(hoveredMonthKey, pinnedMonthKey)).not.toBe("2026-05");
  });

  // TEST 2 — stale fallback does not reappear during interaction
  it("never falls back to the pinned month while a hover value is present, across a simulated pointer walk", () => {
    const pinnedMonthKey = "2026-05"; // Month A pinned once, up front

    // Simulated pointer path: cell in Month B -> gap (no leave fired, so
    // hoveredMonthKey is untouched, not nulled) -> another cell in Month B.
    const hoverSequence: (string | null)[] = ["2026-06", "2026-06", "2026-06"];

    for (const hoveredMonthKey of hoverSequence) {
      expect(resolveActiveMonthKey(hoveredMonthKey, pinnedMonthKey)).toBe("2026-06");
    }
  });

  // TEST 3 — unpin behavior
  it("clears to the active hover (or null) once the pinned month is unpinned", () => {
    const pinnedAfterUnpin = nextPinnedMonthKey("2026-05", "2026-05");
    expect(pinnedAfterUnpin).toBeNull();

    // Another month still actively hovered/focused -> it remains the summary.
    expect(resolveActiveMonthKey("2026-06", pinnedAfterUnpin)).toBe("2026-06");

    // Nothing hovered/focused -> no summary at all.
    expect(resolveActiveMonthKey(null, pinnedAfterUnpin)).toBeNull();
  });

  it("nextPinnedMonthKey pins a new month when a different one is clicked", () => {
    expect(nextPinnedMonthKey(null, "2026-05")).toBe("2026-05");
    expect(nextPinnedMonthKey("2026-05", "2026-06")).toBe("2026-06");
  });

  // TEST 5 — switching between months
  it("switches the active summary as hover moves from Month A to Month B, with no pin involved", () => {
    expect(resolveActiveMonthKey("2026-05", null)).toBe("2026-05");
    expect(resolveActiveMonthKey("2026-06", null)).toBe("2026-06");
  });
});

describe("shouldClearHoverOnFocusOut", () => {
  // TEST 4 — keyboard navigation
  it("does not clear hover when focus moves between elements inside the interactive wrapper", () => {
    const cellA = {};
    const cellB = {};
    const container = fakeContainer(new Set([cellA, cellB]));

    // Tabbing from a month label to a day cell, both inside the wrapper.
    expect(shouldClearHoverOnFocusOut(container, cellB)).toBe(false);
  });

  it("clears hover when focus leaves the interactive wrapper entirely", () => {
    const outsideElement = {};
    const container = fakeContainer(new Set());

    expect(shouldClearHoverOnFocusOut(container, outsideElement)).toBe(true);
  });

  it("clears hover when focus moves to nothing (relatedTarget null, e.g. Tab to browser chrome)", () => {
    const container = fakeContainer(new Set());

    expect(shouldClearHoverOnFocusOut(container, null)).toBe(true);
  });

  it("combined with resolveActiveMonthKey: focus leaving the wrapper lets the pinned month reassert, without a stale hover overriding it", () => {
    const pinnedMonthKey = "2026-05";
    let hoveredMonthKey: string | null = "2026-06"; // focused via keyboard

    const outsideElement = {};
    const container = fakeContainer(new Set());

    if (shouldClearHoverOnFocusOut(container, outsideElement)) {
      hoveredMonthKey = null;
    }

    expect(resolveActiveMonthKey(hoveredMonthKey, pinnedMonthKey)).toBe("2026-05");
  });
});
