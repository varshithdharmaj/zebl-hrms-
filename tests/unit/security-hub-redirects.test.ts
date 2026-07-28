import { beforeEach, describe, expect, it, vi } from "vitest";

const redirect = vi.fn((url: string): never => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirect(url),
}));

describe("security hub legacy redirects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects employee login-history to /employee/security and preserves filters", async () => {
    const { default: page } = await import(
      "@/app/(dashboard)/employee/security/login-history/page"
    );
    await expect(
      page({
        searchParams: Promise.resolve({ q: "chrome", page: "2" }),
      })
    ).rejects.toThrow("NEXT_REDIRECT:/employee/security?q=chrome&page=2");
  });

  it("redirects employee active-sessions to /employee/security", async () => {
    const { default: page } = await import(
      "@/app/(dashboard)/employee/security/active-sessions/page"
    );
    expect(() => page()).toThrow("NEXT_REDIRECT:/employee/security");
  });

  it("redirects admin login-history to /admin/security and preserves employeeId", async () => {
    const { default: page } = await import(
      "@/app/(dashboard)/admin/security/login-history/page"
    );
    await expect(
      page({
        searchParams: Promise.resolve({ employeeId: "42" }),
      })
    ).rejects.toThrow("NEXT_REDIRECT:/admin/security?employeeId=42");
  });

  it("redirects admin active-sessions to /admin/security", async () => {
    const { default: page } = await import(
      "@/app/(dashboard)/admin/security/active-sessions/page"
    );
    expect(() => page()).toThrow("NEXT_REDIRECT:/admin/security");
  });
});
