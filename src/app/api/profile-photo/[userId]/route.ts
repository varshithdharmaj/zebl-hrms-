import { NextResponse } from "next/server";
import { getSessionOrThrow } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { getUserPhotoStorage } from "@/lib/user-photo/storage";

// Gated on "has a valid session" only — any signed-in user can view any
// employee's photo, like a company directory. No per-viewer scope check.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    await getSessionOrThrow();

    const { userId } = await params;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { profilePhotoStorageKey: true },
    });
    if (!user?.profilePhotoStorageKey) {
      return new NextResponse("Not found.", { status: 404 });
    }

    const storage = getUserPhotoStorage();
    const exists = await storage.exists(user.profilePhotoStorageKey);
    if (!exists) {
      return new NextResponse("Not found.", { status: 404 });
    }

    const content = await storage.read(user.profilePhotoStorageKey);
    const contentType = user.profilePhotoStorageKey.toLowerCase().endsWith(".png")
      ? "image/png"
      : user.profilePhotoStorageKey.toLowerCase().endsWith(".webp")
        ? "image/webp"
        : "image/jpeg";

    return new NextResponse(new Uint8Array(content), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": "inline",
        // Never cache: the URL is stable per-user regardless of which photo
        // is behind it, so a cached response would keep serving a replaced
        // photo's old bytes. Matches the recruitment document preview route.
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new NextResponse("Unauthorized.", { status: 401 });
  }
}
