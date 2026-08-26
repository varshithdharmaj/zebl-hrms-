import { describe, expect, it } from "vitest";
import {
  isSessionVersionStale,
  setCachedSessionVersion,
} from "@/lib/session-version-cache";

describe("session version cache", () => {
  it("returns null on cache miss", () => {
    expect(isSessionVersionStale("user-unknown", 1)).toBeNull();
  });

  it("returns false when versions match", () => {
    setCachedSessionVersion("user-1", 3);
    expect(isSessionVersionStale("user-1", 3)).toBe(false);
  });

  it("returns true when versions differ", () => {
    setCachedSessionVersion("user-2", 5);
    expect(isSessionVersionStale("user-2", 4)).toBe(true);
  });
});
