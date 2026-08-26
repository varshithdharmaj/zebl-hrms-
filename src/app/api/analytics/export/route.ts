import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canViewOrgAnalytics } from "@/lib/permissions";
import { generateExecutiveReport, type ReportFormat } from "@/lib/reports/report-generator";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || !canViewOrgAnalytics(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const format = (new URL(request.url).searchParams.get("format") ?? "excel") as ReportFormat;
  if (format !== "excel" && format !== "html") {
    return NextResponse.json({ error: "Invalid format" }, { status: 400 });
  }

  try {
    const report = await generateExecutiveReport(format, session.id);
    const body = typeof report.data === "string" ? report.data : new Uint8Array(report.data);
    return new NextResponse(body, {
      headers: {
        "Content-Type": report.mimeType,
        "Content-Disposition": `attachment; filename="${report.filename}"`,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Export failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
