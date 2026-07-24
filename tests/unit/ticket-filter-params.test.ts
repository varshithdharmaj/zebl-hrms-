import { describe, expect, it } from "vitest";
import {
  ticketListHref,
  ticketListSearchParamsAfterSearch,
  ticketListSearchParamsAfterSelectChange,
  ticketListSearchParamsFromFilters,
  type TicketListFilterState,
} from "@/lib/tickets/filter-params";

const baseFilters: TicketListFilterState = {
  status: "open",
  category: "leave",
  priority: "high",
  search: "payroll",
};

describe("ticketListSearchParamsAfterSelectChange", () => {
  it("updates one select while preserving others and search as q", () => {
    const params = ticketListSearchParamsAfterSelectChange(baseFilters, "status", "resolved");
    expect(Object.fromEntries(params)).toEqual({
      category: "leave",
      priority: "high",
      q: "payroll",
      status: "resolved",
    });
  });

  it("omits a select when value is all (clear filter)", () => {
    const params = ticketListSearchParamsAfterSelectChange(baseFilters, "priority", "all");
    expect(params.has("priority")).toBe(false);
    expect(params.get("status")).toBe("open");
    expect(params.get("q")).toBe("payroll");
  });

  it("omits all defaults when clearing everything via all", () => {
    const params = ticketListSearchParamsAfterSelectChange(
      { status: "all", category: "all", priority: "all", search: "" },
      "status",
      "all"
    );
    expect(params.toString()).toBe("");
  });
});

describe("ticketListSearchParamsAfterSearch", () => {
  it("sets q from the new search value and preserves selects", () => {
    const params = ticketListSearchParamsAfterSearch(baseFilters, "badge");
    expect(Object.fromEntries(params)).toEqual({
      status: "open",
      category: "leave",
      priority: "high",
      q: "badge",
    });
  });

  it("clears q when search is empty", () => {
    const params = ticketListSearchParamsAfterSearch(baseFilters, "");
    expect(params.has("q")).toBe(false);
    expect(params.get("status")).toBe("open");
  });
});

describe("ticketListSearchParamsFromFilters", () => {
  it("serializes current filters and optional page", () => {
    const params = ticketListSearchParamsFromFilters(baseFilters, { page: 2 });
    expect(Object.fromEntries(params)).toEqual({
      status: "open",
      category: "leave",
      priority: "high",
      q: "payroll",
      page: "2",
    });
  });
});

describe("ticketListHref", () => {
  it("appends query string only when params exist", () => {
    expect(ticketListHref("/admin/tickets", new URLSearchParams())).toBe("/admin/tickets");
    expect(ticketListHref("/admin/tickets/anonymous", new URLSearchParams("status=new"))).toBe(
      "/admin/tickets/anonymous?status=new"
    );
  });
});
