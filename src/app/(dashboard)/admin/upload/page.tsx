import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { UploadForm } from "@/components/admin/upload-form";
import { isAttendanceImportPreviewEnabled } from "@/lib/config/attendance-import";
import { toISODate, startOfDay } from "@/lib/utils";

export default function UploadPage() {
  const today = toISODate(startOfDay());
  const previewEnabled = isAttendanceImportPreviewEnabled();

  return (
    <div className="space-y-6 lg:space-y-8">
      <WorkspacePageHeader
        title="Upload attendance"
        description={
          previewEnabled
            ? "Preview and validate Excel or PDF attendance reports before importing."
            : "Import attendance records from supported Excel or PDF reports."
        }
      />
      <UploadForm defaultDate={today} previewEnabled={previewEnabled} />
    </div>
  );
}
