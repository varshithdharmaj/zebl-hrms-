import { describe, expect, it } from "vitest";
import { AppError, toClientError } from "@/lib/errors/app-error";

describe("AppError", () => {
  it("maps workflow errors to 400", () => {
    const err = new AppError({ code: "WORKFLOW", message: "Step inactive" });
    expect(err.statusCode).toBe(400);
    expect(toClientError(err).error).toBe("Step inactive");
  });

  it("hides internal errors from clients", () => {
    const err = new AppError({ code: "INTERNAL", message: "DB exploded", expose: false });
    const client = toClientError(err, "cid-1");
    expect(client.error).not.toContain("exploded");
    expect(client.correlationId).toBe("cid-1");
  });
});
