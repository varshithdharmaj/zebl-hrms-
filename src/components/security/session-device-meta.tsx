import {
  Chrome,
  Globe,
  Monitor,
  Smartphone,
  Tablet,
} from "lucide-react";

export function browserIconLabel(
  browser: string | null | undefined,
  version?: string | null
): string {
  const name = browser?.trim() || "Unknown";
  const ver = version && version !== "Unknown" ? ` ${version}` : "";
  return `${name}${ver}`;
}

export function BrowserGlyph({
  browser,
  device,
  className = "h-4 w-4",
}: {
  browser?: string | null;
  device?: string | null;
  className?: string;
}) {
  const b = (browser ?? "").toLowerCase();
  const d = (device ?? "").toLowerCase();

  if (d.includes("mobile") || d.includes("phone")) {
    return <Smartphone className={className} aria-hidden />;
  }
  if (d.includes("tablet") || d.includes("ipad")) {
    return <Tablet className={className} aria-hidden />;
  }
  if (b.includes("chrome") || b.includes("chromium") || b.includes("edge")) {
    return <Chrome className={className} aria-hidden />;
  }
  if (b.includes("firefox") || b.includes("safari") || b.includes("opera")) {
    return <Globe className={className} aria-hidden />;
  }
  return <Monitor className={className} aria-hidden />;
}
