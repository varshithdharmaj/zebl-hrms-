import { describe, expect, it, vi, beforeEach } from "vitest";
import { detectCircularManagerRelationship } from "@/lib/org";

const findUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    employee: {
      findUnique: (...args: unknown[]) => findUnique(...args),
    },
  },
}));

describe("manager hierarchy", () => {
  beforeEach(() => {
    findUnique.mockReset();
  });

  it("detects direct circular assignment", async () => {
    findUnique.mockImplementation(async ({ where }: { where: { id: number } }) => {
      if (where.id === 2) return { id: 2, managerId: 1 };
      if (where.id === 1) return { id: 1, managerId: 2 };
      return null;
    });
    const circular = await detectCircularManagerRelationship(1, 2);
    expect(circular).toBe(true);
  });

  it("allows valid chain", async () => {
    findUnique.mockImplementation(async ({ where }: { where: { id: number } }) => {
      if (where.id === 3) return { id: 3, managerId: 2 };
      if (where.id === 2) return { id: 2, managerId: 1 };
      if (where.id === 1) return { id: 1, managerId: null };
      return null;
    });
    const circular = await detectCircularManagerRelationship(3, 1);
    expect(circular).toBe(false);
  });
});
