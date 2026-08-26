import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { PayrollSettingsForm } from "@/components/admin/payroll/payroll-settings-form";
import { getPayrollSettings } from "@/lib/payroll/payroll-settings";

export default async function PayrollSettingsPage() {
  const settings = await getPayrollSettings();

  return (
    <div className="space-y-8">
      <WorkspacePageHeader
        title="Payroll settings"
        description="Configure payroll cycle, required office time, grace, OT thresholds, and per-shift overrides."
      />
      <PayrollSettingsForm settings={settings} />
    </div>
  );
}
