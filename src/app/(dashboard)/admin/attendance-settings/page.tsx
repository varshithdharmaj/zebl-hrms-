import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { AttendanceSettingsView } from "@/components/admin/attendance-settings-view";
import { getSession } from "@/lib/auth";
import { canManageAttendanceScheduling } from "@/lib/permissions";
import { getAttendanceSettings, getDateOverridesForRange } from "@/lib/attendance/attendance-settings";
import { startOfDay } from "@/lib/utils";

export default async function AttendanceSettingsPage() {
  const session = await getSession();
  const canEdit = session ? canManageAttendanceScheduling(session.role) : false;

  // Show overrides from today onward, plus a 90-day lookback for recently-added ones.
  const rangeStart = new Date(startOfDay().getTime() - 90 * 24 * 60 * 60 * 1000);
  const rangeEnd = new Date(startOfDay().getTime() + 365 * 24 * 60 * 60 * 1000);

  const [settings, overrides] = await Promise.all([
    getAttendanceSettings(),
    getDateOverridesForRange(rangeStart, rangeEnd),
  ]);

  return (
    <div className="space-y-8">
      <WorkspacePageHeader
        title="Attendance settings"
        description="Configure the organization's default weekly working schedule and date-specific exceptions."
      />
      <AttendanceSettingsView settings={settings} overrides={overrides} canEdit={canEdit} />
    </div>
  );
}
