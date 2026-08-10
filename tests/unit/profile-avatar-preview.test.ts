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
});
