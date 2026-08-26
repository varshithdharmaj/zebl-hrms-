import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { validateDatabaseUrl } from "@/lib/config/database";

describe("validateDatabaseUrl", () => {
  const prev = process.env.DATABASE_URL;

  afterEach(() => {
    if (prev === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = prev;
  });

  it("accepts postgresql URL", () => {
    process.env.DATABASE_URL = "postgresql://u:p@localhost:5432/db";
    expect(validateDatabaseUrl().ok).toBe(true);
  });

  it("rejects sqlite file URL", () => {
    process.env.DATABASE_URL = "file:./attendance_manager.db";
    const r = validateDatabaseUrl();
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/SQLite/i);
  });

  it("rejects missing URL", () => {
    delete process.env.DATABASE_URL;
    expect(validateDatabaseUrl().ok).toBe(false);
  });
});
