import { describe, expect, it, vi } from "vitest";
import { createLocalImagePreviewController } from "@/lib/profile-avatar/local-preview-controller";
import { resolveProfileAvatarSrc } from "@/lib/profile-avatar/display";
import { DEFAULT_PROFILE_AVATAR_SRC } from "@/lib/profile-avatar/constants";

function makeFile(name: string, size: number, type: string): File {
  const blob = new Blob([new Uint8Array(Math.min(size, 64))], { type });
  const file = new File([blob], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

describe("createLocalImagePreviewController", () => {
  it("creates a local preview URL for a valid JPEG and revokes on remove", () => {
    const created: string[] = [];
    const revoked: string[] = [];
    const controller = createLocalImagePreviewController({
      objectUrlApi: {
        createObjectURL: () => {
          const url = `blob:mock-${created.length + 1}`;
          created.push(url);
          return url;
        },
        revokeObjectURL: (url) => {
          revoked.push(url);
        },
      },
    });

    const selected = controller.select(makeFile("photo.jpg", 1200, "image/jpeg"));
    expect(selected.error).toBeNull();
    expect(selected.previewUrl).toBe("blob:mock-1");
    expect(selected.file?.name).toBe("photo.jpg");
    expect(
      resolveProfileAvatarSrc({
        previewUrl: selected.previewUrl,
        imageUrl: null,
        cleared: selected.cleared,
      })
    ).toBe("blob:mock-1");

    const cleared = controller.clear();
    expect(revoked).toEqual(["blob:mock-1"]);
    expect(cleared.previewUrl).toBeNull();
    expect(cleared.cleared).toBe(true);
    expect(
      resolveProfileAvatarSrc({
        previewUrl: cleared.previewUrl,
        imageUrl: null,
        cleared: cleared.cleared,
      })
    ).toBe(DEFAULT_PROFILE_AVATAR_SRC);
  });

  it("keeps prior preview when an invalid file is rejected", () => {
    const controller = createLocalImagePreviewController({
      objectUrlApi: {
        createObjectURL: () => "blob:keep",
        revokeObjectURL: vi.fn(),
      },
    });

    controller.select(makeFile("ok.png", 800, "image/png"));
    const rejected = controller.select(makeFile("bad.gif", 800, "image/gif"));
    expect(rejected.error).toMatch(/JPEG, PNG, or WebP/i);
    expect(rejected.previewUrl).toBe("blob:keep");
  });

  it("does not call fetch when selecting or clearing a photo", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response());
    const controller = createLocalImagePreviewController({
      objectUrlApi: {
        createObjectURL: () => "blob:x",
        revokeObjectURL: vi.fn(),
      },
    });
    controller.select(makeFile("ok.webp", 900, "image/webp"));
    controller.clear();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("revertToPersisted() discards the optimistic preview WITHOUT marking it cleared (failed upload)", () => {
    const revoked: string[] = [];
    const controller = createLocalImagePreviewController({
      objectUrlApi: {
        createObjectURL: () => "blob:mock-revert",
        revokeObjectURL: (url) => revoked.push(url),
      },
    });

    controller.select(makeFile("rejected.jpg", 1200, "image/jpeg"));
    const reverted = controller.revertToPersisted();

    expect(revoked).toEqual(["blob:mock-revert"]);
    expect(reverted.previewUrl).toBeNull();
    expect(reverted.file).toBeNull();
    // The critical distinction from clear(): cleared stays false, so the
    // caller's still-valid persisted imageUrl is trusted again instead of
    // falling back to the default avatar.
    expect(reverted.cleared).toBe(false);
  });

  it("after revertToPersisted(), resolveProfileAvatarSrc falls back to the persisted imageUrl, not the default avatar", () => {
    const controller = createLocalImagePreviewController({
      objectUrlApi: {
        createObjectURL: () => "blob:mock-revert-2",
        revokeObjectURL: vi.fn(),
      },
    });

    controller.select(makeFile("rejected.png", 1200, "image/png"));
    const reverted = controller.revertToPersisted();

    const src = resolveProfileAvatarSrc({
      previewUrl: reverted.previewUrl,
      imageUrl: "/api/profile-photo/user-1",
      cleared: reverted.cleared,
    });
    expect(src).toBe("/api/profile-photo/user-1");
    expect(src).not.toBe(DEFAULT_PROFILE_AVATAR_SRC);
  });

  it("clear() and revertToPersisted() differ: only clear() forces the default avatar", () => {
    const makeController = () =>
      createLocalImagePreviewController({
        objectUrlApi: { createObjectURL: () => "blob:x", revokeObjectURL: vi.fn() },
      });

    const removed = makeController();
    removed.select(makeFile("a.jpg", 1000, "image/jpeg"));
    const clearedState = removed.clear();
    expect(
      resolveProfileAvatarSrc({
        previewUrl: clearedState.previewUrl,
        imageUrl: "/api/profile-photo/user-1",
        cleared: clearedState.cleared,
      })
    ).toBe(DEFAULT_PROFILE_AVATAR_SRC);

    const failed = makeController();
    failed.select(makeFile("b.jpg", 1000, "image/jpeg"));
    const revertedState = failed.revertToPersisted();
    expect(
      resolveProfileAvatarSrc({
        previewUrl: revertedState.previewUrl,
        imageUrl: "/api/profile-photo/user-1",
        cleared: revertedState.cleared,
      })
    ).toBe("/api/profile-photo/user-1");
  });
});
