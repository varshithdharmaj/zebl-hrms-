import { headers } from "next/headers";

export type RequestSecurityContext = {
  ipAddress: string;
  browser: string;
  browserVersion: string;
  device: string;
  operatingSystem: string;
  userAgent: string;
};

export function parseUserAgent(userAgent: string): Omit<RequestSecurityContext, "ipAddress"> {
  const browserMatch =
    userAgent.match(/Edg\/([\d.]+)/) ??
    userAgent.match(/Chrome\/([\d.]+)/) ??
    userAgent.match(/Firefox\/([\d.]+)/) ??
    userAgent.match(/Version\/([\d.]+).*Safari/) ??
    userAgent.match(/MSIE\s([\d.]+)/);

  let browser = "Unknown";
  if (/Edg\//.test(userAgent)) browser = "Edge";
  else if (/Chrome\//.test(userAgent)) browser = "Chrome";
  else if (/Firefox\//.test(userAgent)) browser = "Firefox";
  else if (/Safari\//.test(userAgent)) browser = "Safari";
  else if (/MSIE|Trident/.test(userAgent)) browser = "Internet Explorer";

  let operatingSystem = "Unknown";
  if (/Windows NT 10/.test(userAgent)) operatingSystem = "Windows";
  else if (/Android/.test(userAgent)) operatingSystem = "Android";
  else if (/iPhone|iPad|iPod/.test(userAgent)) operatingSystem = "iOS";
  else if (/Mac OS X/.test(userAgent)) operatingSystem = "macOS";
  else if (/Linux/.test(userAgent)) operatingSystem = "Linux";

  const device = /iPad|Tablet/.test(userAgent)
    ? "Tablet"
    : /Mobile|Android|iPhone|iPod/.test(userAgent)
      ? "Mobile"
      : "Desktop";

  return {
    browser,
    browserVersion: browserMatch?.[1] ?? "Unknown",
    device,
    operatingSystem,
    userAgent: userAgent.slice(0, 1024),
  };
}

export async function getRequestSecurityContext(): Promise<RequestSecurityContext> {
  try {
    const headerStore = await headers();
    const userAgent = headerStore.get("user-agent") ?? "Unknown";
    const forwarded = headerStore.get("x-forwarded-for");
    const ipAddress =
      forwarded?.split(",")[0]?.trim() ??
      headerStore.get("x-real-ip") ??
      "unknown";
    return {
      ipAddress,
      ...parseUserAgent(userAgent),
    };
  } catch {
    return {
      ipAddress: "unknown",
      ...parseUserAgent("Unknown"),
    };
  }
}
