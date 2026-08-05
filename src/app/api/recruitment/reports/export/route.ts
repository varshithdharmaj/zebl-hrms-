import { NextResponse } from "next/server";
import { isRecruitmentModuleEnabled } from "@/lib/recruitment/config/feature-flags";
import { requireRecruitmentReportSession } from "@/lib/recruitment/reports/auth";
import { buildReportBundle } from "@/lib/recruitment/reports/build-report-bundle";
import { buildReportExport } from "@/lib/recruitment/reports/export";
import { exportReportSchema } from "@/lib/recruitment/reports/filter-schema";
import { toReportFilters } from "@/lib/recruitment/reports/parse-filters";
import { isRecruitmentDomainError } from "@/lib/recruitment/shared/errors";
import { PermissionError } from "@/lib/permissions";

export async function GET(request: Request) {
  try {
    if (!isRecruitmentModuleEnabled()) {
      return NextResponse.json(
        { error: "Recruitment module is disabled." },
        { status: 403 }
      );
    }

    const session = await requireRecruitmentReportSession();
    const { searchParams } = new URL(request.url);
    const selected = searchParams.getAll("selectedRowIds");
    const parsed = exportReportSchema.safeParse({
      section: searchParams.get("section"),
      format: searchParams.get("format") ?? "xlsx",
      tableId: searchParams.get("tableId") ?? undefined,
      selectedRowIds: selected.length > 0 ? selected : undefined,
      filters: {
        startDate: searchParams.get("startDate") ?? undefined,
        endDate: searchParams.get("endDate") ?? undefined,
        department: searchParams.get("department") ?? undefined,
        recruiterUserId: searchParams.get("recruiterUserId") ?? undefined,
        jobOpeningId: searchParams.get("jobOpeningId") ?? undefined,
        location: searchParams.get("location") ?? undefined,
        employmentType: searchParams.get("employmentType") ?? undefined,
        status: searchParams.get("status") ?? undefined,
        search: searchParams.get("search") ?? undefined,
        days: searchParams.get("days") ?? undefined,
      },
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid export request." },
        { status: 400 }
      );
    }

    const filters = toReportFilters(parsed.data.filters);
    const bundle = await buildReportBundle(
      session,
      parsed.data.section,
      filters
    );
    const exported = buildReportExport(bundle, parsed.data.format, {
      tableId: parsed.data.tableId,
      selectedRowIds: parsed.data.selectedRowIds,
    });

    const body =
      typeof exported.data === "string"
        ? exported.data
        : new Uint8Array(exported.data);

    return new NextResponse(body, {
      headers: {
        "Content-Type": exported.mimeType,
        "Content-Disposition": `attachment; filename="${exported.filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (isRecruitmentDomainError(error)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Export failed." },
      { status: 500 }
    );
  }
}
