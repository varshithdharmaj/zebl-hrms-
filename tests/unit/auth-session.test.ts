import { describe, expect, it } from "vitest";
import { createSessionToken, verifySessionToken } from "@/lib/session";
import type { SessionUser } from "@/lib/session";

describe("session JWT", () => {
  const user: SessionUser = {
    id: "user-1",
    email: "hr@zebl.com",
    role: "super_admin",
    employeeId: null,
    employeeName: null,
    sessionVersion: 2,
    authProvider: "local",
  };

  it("round-trips sessionVersion in JWT", async () => {
    const token = await createSessionToken(user);
    const payload = await verifySessionToken(token);
    expect(payload?.sessionVersion).toBe(2);
    expect(payload?.role).toBe("super_admin");
    expect(payload?.id).toBe("user-1");
  });

  it("returns null for malformed tokens", async () => {
    const payload = await verifySessionToken("not-a-jwt");
    expect(payload).toBeNull();
  });

  it("round-trips the database-backed session id as JWT jti", async () => {
    const token = await createSessionToken(user, "session-123");
    const payload = await verifySessionToken(token);
    expect(payload?.sessionId).toBe("session-123");
  });
});
