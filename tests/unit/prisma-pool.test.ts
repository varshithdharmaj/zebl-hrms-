import { describe, expect, it } from "vitest";
import {
  DEFAULT_DATABASE_POOL_MAX,
  MAX_DATABASE_POOL_MAX,
  resolveDatabasePoolMax,
  usesPgBouncer,
} from "@/lib/prisma-pool";

describe("resolveDatabasePoolMax", () => {
  it("defaults to 5", () => {
    expect(resolveDatabasePoolMax(undefined)).toBe(DEFAULT_DATABASE_POOL_MAX);
    expect(resolveDatabasePoolMax("")).toBe(DEFAULT_DATABASE_POOL_MAX);
  });

  it("parses a positive integer and caps at 20", () => {
    expect(resolveDatabasePoolMax("8")).toBe(8);
    expect(resolveDatabasePoolMax("999")).toBe(MAX_DATABASE_POOL_MAX);
  });

  it("rejects non-positive values", () => {
    expect(resolveDatabasePoolMax("0")).toBe(DEFAULT_DATABASE_POOL_MAX);
    expect(resolveDatabasePoolMax("-2")).toBe(DEFAULT_DATABASE_POOL_MAX);
  });
});

describe("usesPgBouncer", () => {
  it("detects pgbouncer=true and port 6543", () => {
    expect(usesPgBouncer("postgresql://u:p@host:5432/db?pgbouncer=true")).toBe(true);
    expect(usesPgBouncer("postgresql://u:p@host:6543/db")).toBe(true);
    expect(usesPgBouncer("postgresql://u:p@host:5432/db")).toBe(false);
  });
});
