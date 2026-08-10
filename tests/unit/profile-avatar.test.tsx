import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProfileAvatar } from "@/components/shared/profile-avatar";
import {
  DEFAULT_PROFILE_AVATAR_SRC,
  PROFILE_AVATAR_MAX_BYTES,
  profileAvatarHasCustomImage,
  resolveProfileAvatarSrc,
  validateProfileAvatarFile,
} from "@/lib/profile-avatar";

function makeFile(name: string, size: number, type: string): File {
  const blob = new Blob([new Uint8Array(Math.min(size, 64))], { type });
  const file = new File([blob], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

describe("validateProfileAvatarFile", () => {
  it("accepts JPEG, PNG, and WebP within the 2 MB limit", () => {
    expect(validateProfileAvatarFile(makeFile("a.jpg", 1024, "image/jpeg")).ok).toBe(true);
    expect(validateProfileAvatarFile(makeFile("a.jpeg", 2048, "image/jpeg")).ok).toBe(true);
    expect(validateProfileAvatarFile(makeFile("a.png", 4096, "image/png")).ok).toBe(true);
    expect(validateProfileAvatarFile(makeFile("a.webp", 8192, "image/webp")).ok).toBe(true);
  });

  it("rejects files above 2 MB", () => {
    const result = validateProfileAvatarFile(
      makeFile("big.png", PROFILE_AVATAR_MAX_BYTES + 1, "image/png")
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/too large/i);
      expect(result.error).toMatch(/2 MB/i);
    }
  });

  it("rejects unsupported file types", () => {
    const gif = validateProfileAvatarFile(makeFile("x.gif", 100, "image/gif"));
    expect(gif.ok).toBe(false);
    if (!gif.ok) {
      expect(gif.error).toMatch(/JPEG, PNG, or WebP/i);
    }

    const pdf = validateProfileAvatarFile(makeFile("x.pdf", 100, "application/pdf"));
    expect(pdf.ok).toBe(false);
  });

  it("rejects empty selection and empty files", () => {
    expect(validateProfileAvatarFile(null).ok).toBe(false);
    expect(validateProfileAvatarFile(makeFile("empty.png", 0, "image/png")).ok).toBe(false);
  });

  it("does not perform any network request while validating", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response());
    validateProfileAvatarFile(makeFile("ok.jpg", 500, "image/jpeg"));
    validateProfileAvatarFile(makeFile("bad.gif", 500, "image/gif"));
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe("resolveProfileAvatarSrc", () => {
  it("uses the default avatar when no image exists", () => {
    expect(
      resolveProfileAvatarSrc({
        previewUrl: null,
        imageUrl: null,
        cleared: false,
      })
    ).toBe(DEFAULT_PROFILE_AVATAR_SRC);
  });

  it("prefers a local preview over a persisted URL", () => {
    expect(
      resolveProfileAvatarSrc({
        previewUrl: "blob:preview",
        imageUrl: "https://cdn.example/photo.jpg",
        cleared: false,
      })
    ).toBe("blob:preview");
  });

  it("restores the default avatar after remove", () => {
    expect(
      resolveProfileAvatarSrc({
        previewUrl: null,
        imageUrl: "https://cdn.example/photo.jpg",
        cleared: true,
      })
    ).toBe(DEFAULT_PROFILE_AVATAR_SRC);
    expect(
      profileAvatarHasCustomImage({
        previewUrl: null,
        imageUrl: "https://cdn.example/photo.jpg",
        cleared: true,
      })
    ).toBe(false);
  });

  it("treats a selected preview as a custom image", () => {
    expect(
      profileAvatarHasCustomImage({
        previewUrl: "blob:preview",
        imageUrl: null,
        cleared: false,
      })
    ).toBe(true);
  });
});

describe("ProfileAvatar UI", () => {
  it("renders the default avatar when no image exists", () => {
    const html = renderToStaticMarkup(
      <ProfileAvatar alt="Ada Lovelace profile photo" editable={false} />
    );
    expect(html).toContain(DEFAULT_PROFILE_AVATAR_SRC);
    expect(html).toContain('alt="Ada Lovelace profile photo"');
  });

  it("shows upload controls for editable profiles", () => {
    const html = renderToStaticMarkup(
      <ProfileAvatar alt="Employee photo" editable />
    );
    expect(html).toContain("Upload photo");
    expect(html).toContain('aria-label="Upload photo"');
    expect(html).toContain('type="file"');
    expect(html).toContain("image/jpeg");
    expect(html).toContain("image/png");
    expect(html).toContain("image/webp");
  });

  it("hides upload controls for non-editable profiles", () => {
    const html = renderToStaticMarkup(
      <ProfileAvatar alt="Team member photo" editable={false} />
    );
    expect(html).not.toContain("Upload photo");
    expect(html).not.toContain("Change photo");
    expect(html).not.toContain('type="file"');
    expect(html).not.toContain("Remove");
  });

  it("exposes keyboard-accessible photo actions when editable", () => {
    const html = renderToStaticMarkup(
      <ProfileAvatar alt="Candidate photo" editable />
    );
    expect(html).toContain('type="button"');
    expect(html).toContain('aria-label="Upload photo"');
    expect(html).toContain("focus-visible:ring");
  });

  it("renders a provided image URL as the current photo", () => {
    const html = renderToStaticMarkup(
      <ProfileAvatar
        alt="Persisted photo"
        imageUrl="https://cdn.example/avatar.png"
        editable
      />
    );
    expect(html).toContain("https://cdn.example/avatar.png");
    expect(html).toContain("Change photo");
    expect(html).toContain("Remove");
  });

  it("does not call fetch when rendering the avatar UI", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response());
    renderToStaticMarkup(<ProfileAvatar alt="No network" editable />);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
