import { beforeEach, describe, expect, it, vi } from "vitest";
import { getManager } from "@/lib/org";

const findUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    employee: {
      findUnique: (...args: unknown[]) => findUnique(...args),
    },
  },
}));

describe("getManager active filter", () => {
  beforeEach(() => {
    findUnique.mockReset();
  });

  it("returns null when manager is inactive (approval routing falls to HR)", async () => {
    findUnique.mockResolvedValue({
      manager: {
        id: 10,
        employeeCode: "M10",
        name: "Inactive Lead",
        department: "Eng",
        designation: "TL",
        isActive: false,
      },
    });

    await expect(getManager(1)).resolves.toBeNull();
  });

  it("returns manager summary when active", async () => {
    findUnique.mockResolvedValue({
      manager: {
        id: 10,
        employeeCode: "M10",
        name: "Active Lead",
        department: "Eng",
        designation: "TL",
        isActive: true,
      },
    });

    await expect(getManager(1)).resolves.toEqual({
      id: 10,
      employeeCode: "M10",
      name: "Active Lead",
      department: "Eng",
      designation: "TL",
    });
  });
});
