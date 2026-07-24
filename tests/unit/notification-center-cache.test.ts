import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  __resetNotificationCenterCacheForTests,
  loadNotificationCenter,
} from "@/components/layout/notification-center";

describe("loadNotificationCenter cache", () => {
  beforeEach(() => {
    __resetNotificationCenterCacheForTests();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          items: [
            {
              id: "pending-approvals",
              title: "1 leave approval(s)",
              description: "Awaiting your decision",
              href: "/admin/leaves",
              severity: "warning",
              createdAt: new Date().toISOString(),
            },
          ],
        })
      )
    );
  });

  afterEach(() => {
    __resetNotificationCenterCacheForTests();
    vi.unstubAllGlobals();
  });

  it("dedupes concurrent in-flight requests", async () => {
    const [a, b] = await Promise.all([loadNotificationCenter(), loadNotificationCenter()]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(a.items).toHaveLength(1);
    expect(b.items).toHaveLength(1);
  });

  it("serves the TTL cache without a second network call", async () => {
    await loadNotificationCenter();
    await loadNotificationCenter();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("refetches after the cache is reset", async () => {
    await loadNotificationCenter();
    __resetNotificationCenterCacheForTests();
    await loadNotificationCenter();
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
