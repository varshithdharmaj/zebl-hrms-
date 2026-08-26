import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { UploadForm } from "@/components/admin/upload-form";

export default function UploadPage() {
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-6 lg:space-y-8">
      <WorkspacePageHeader
        title="Upload attendance"
        description="Import daily attendance from an Excel file. Records are matched by employee code."
      />
      <UploadForm defaultDate={today} />
    </div>
  );
}
