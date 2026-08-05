"use client";

import React, { useTransition } from "react";
import { useRouter } from "next/navigation";
import { createOfferAction, updateOfferAction } from "@/actions/recruitment-offers";
import { Button } from "@/components/ui/button";

interface OfferFormProps {
  mode: "create" | "edit";
  offer?: any;
  applicationId?: string;
  applications?: any[];
  employees: { id: number; name: string }[];
}

export function OfferForm({
  mode,
  offer,
  applicationId,
  applications = [],
  employees,
}: OfferFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = React.useState<string | null>(null);

  // Form states
  const [selectedAppId, setSelectedAppId] = React.useState(
    offer?.applicationId ?? applicationId ?? applications[0]?.id ?? ""
  );
  const [employmentType, setEmploymentType] = React.useState(offer?.employmentType ?? "Full-time");
  const [department, setDepartment] = React.useState(offer?.department ?? "Engineering");
  const [location, setLocation] = React.useState(offer?.location ?? "Bangalore");
  const [grade, setGrade] = React.useState(offer?.grade ?? "L1");
  const [reportingManagerId, setReportingManagerId] = React.useState<string>(
    offer?.reportingManagerId ? String(offer.reportingManagerId) : ""
  );
  const [joiningDate, setJoiningDate] = React.useState(
    offer?.joiningDate ? new Date(offer.joiningDate).toISOString().slice(0, 10) : ""
  );
  const [expiresAt, setExpiresAt] = React.useState(
    offer?.expiresAt ? new Date(offer.expiresAt).toISOString().slice(0, 10) : ""
  );
  const [currency, setCurrency] = React.useState(offer?.currency ?? "INR");
  const [baseSalary, setBaseSalary] = React.useState<string>(
    offer?.baseSalary ? String(offer.baseSalary) : ""
  );
  const [variablePay, setVariablePay] = React.useState<string>(
    offer?.variablePay ? String(offer.variablePay) : ""
  );
  const [bonus, setBonus] = React.useState<string>(offer?.bonus ? String(offer.bonus) : "");
  const [stock, setStock] = React.useState(offer?.stock ?? "");
  const [ctc, setCtc] = React.useState<string>(offer?.ctc ? String(offer.ctc) : "");
  const [probationDays, setProbationDays] = React.useState<string>(
    offer?.probationDays ? String(offer.probationDays) : "90"
  );
  const [noticeBuyout, setNoticeBuyout] = React.useState<boolean>(offer?.noticeBuyout ?? false);
  const [offerPdfKey, setOfferPdfKey] = React.useState(offer?.offerPdfKey ?? "");
  const [offerNotes, setOfferNotes] = React.useState(offer?.offerNotes ?? "");
  const [benefitsNotes, setBenefitsNotes] = React.useState(offer?.benefitsNotes ?? "");

  // Auto-calculate CTC if base, variable, bonus are changed
  React.useEffect(() => {
    const base = parseFloat(baseSalary) || 0;
    const variable = parseFloat(variablePay) || 0;
    const bon = parseFloat(bonus) || 0;
    const calculatedCtc = base + variable + bon;
    if (calculatedCtc > 0) {
      setCtc(String(calculatedCtc));
    }
  }, [baseSalary, variablePay, bonus]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedAppId) {
      setError("Please select an application.");
      return;
    }
    if (!baseSalary || parseFloat(baseSalary) <= 0) {
      setError("Please enter a positive base salary.");
      return;
    }
    if (!joiningDate) {
      setError("Please select a joining date.");
      return;
    }
    if (!ctc || parseFloat(ctc) <= 0) {
      setError("Please enter a positive CTC.");
      return;
    }

    const payload = {
      id: offer?.id,
      applicationId: selectedAppId,
      employmentType,
      department,
      location,
      grade,
      reportingManagerId: reportingManagerId ? parseInt(reportingManagerId) : null,
      joiningDate: new Date(joiningDate).toISOString(),
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      currency,
      baseSalary: parseFloat(baseSalary),
      variablePay: variablePay ? parseFloat(variablePay) : null,
      bonus: bonus ? parseFloat(bonus) : null,
      stock: stock || null,
      ctc: parseFloat(ctc),
      probationDays: probationDays ? parseInt(probationDays) : null,
      noticeBuyout,
      offerPdfKey: offerPdfKey || null,
      offerNotes: offerNotes || null,
      benefitsNotes: benefitsNotes || null,
      salaryBreakdownJson: {
        base: parseFloat(baseSalary) || 0,
        variable: parseFloat(variablePay) || 0,
        bonus: parseFloat(bonus) || 0,
      },
    };

    startTransition(async () => {
      const action = mode === "create" ? createOfferAction : updateOfferAction;
      const res = await action({}, payload);

      if (res.error) {
        setError(res.error);
      } else {
        router.push(
          applicationId
            ? `/admin/recruitment/applications/${applicationId}`
            : `/admin/recruitment/offers`
        );
        router.refresh();
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Section 1: Application & Candidate */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-subtle space-y-4">
        <h3 className="text-lg font-semibold text-foreground border-b border-border pb-2">
          Candidate & Application
        </h3>
        <div>
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
            Application <span className="text-red-500">*</span>
          </label>
          {mode === "edit" || applicationId ? (
            <div className="h-9 w-full rounded-lg border border-input bg-muted px-3 py-1.5 text-sm text-muted-foreground">
              {offer?.application?.candidate
                ? `${offer.application.candidate.firstName} ${offer.application.candidate.lastName} - ${offer.application.jobOpening?.title}`
                : "Selected Application"}
            </div>
          ) : (
            <select
              value={selectedAppId}
              onChange={(e) => setSelectedAppId(e.target.value)}
              className="w-full h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Select Application</option>
              {applications.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.candidate.firstName} {app.candidate.lastName} - {app.jobOpening.title}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Section 2: Employment Details */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-subtle space-y-4">
        <h3 className="text-lg font-semibold text-foreground border-b border-border pb-2">
          Employment Details
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
              Employment Type <span className="text-red-500">*</span>
            </label>
            <select
              value={employmentType}
              onChange={(e) => setEmploymentType(e.target.value)}
              className="w-full h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="Full-time">Full-time</option>
              <option value="Part-time">Part-time</option>
              <option value="Contract">Contract</option>
              <option value="Internship">Internship</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
              Department <span className="text-red-500">*</span>
            </label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="Engineering">Engineering</option>
              <option value="HR">HR</option>
              <option value="Sales">Sales</option>
              <option value="Marketing">Marketing</option>
              <option value="Product">Product</option>
              <option value="Finance">Finance</option>
              <option value="Operations">Operations</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
              Location <span className="text-red-500">*</span>
            </label>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="Bangalore">Bangalore</option>
              <option value="Mumbai">Mumbai</option>
              <option value="Delhi">Delhi</option>
              <option value="Remote">Remote</option>
              <option value="Hybrid">Hybrid</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
              Grade <span className="text-red-500">*</span>
            </label>
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="w-full h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="L1">L1 - Associate</option>
              <option value="L2">L2 - Senior Associate</option>
              <option value="L3">L3 - Consultant / Lead</option>
              <option value="L4">L4 - Manager / Architect</option>
              <option value="L5">L5 - Director / Principal</option>
              <option value="L6">L6 - VP / Executive</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
              Reporting Manager
            </label>
            <select
              value={reportingManagerId}
              onChange={(e) => setReportingManagerId(e.target.value)}
              className="w-full h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Select Reporting Manager</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Section 3: Compensation & CTC */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-subtle space-y-4">
        <h3 className="text-lg font-semibold text-foreground border-b border-border pb-2">
          Compensation & CTC
        </h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
              Currency <span className="text-red-500">*</span>
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="INR">INR (₹)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
              Base Salary <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={baseSalary}
              onChange={(e) => setBaseSalary(e.target.value)}
              placeholder="e.g. 1200000"
              className="w-full h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
              Variable Pay
            </label>
            <input
              type="number"
              value={variablePay}
              onChange={(e) => setVariablePay(e.target.value)}
              placeholder="e.g. 200000"
              className="w-full h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
              One-time Bonus
            </label>
            <input
              type="number"
              value={bonus}
              onChange={(e) => setBonus(e.target.value)}
              placeholder="e.g. 100000"
              className="w-full h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
              Stock Options / Equity
            </label>
            <input
              type="text"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              placeholder="e.g. 500 RSUs"
              className="w-full h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
              Total CTC <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={ctc}
              onChange={(e) => setCtc(e.target.value)}
              placeholder="Auto-calculated CTC"
              className="w-full h-9 rounded-lg border border-input bg-muted px-3 py-1 text-sm font-semibold text-foreground focus-visible:outline-none"
              readOnly
            />
          </div>
        </div>
      </div>

      {/* Section 4: Joining & Expiry */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-subtle space-y-4">
        <h3 className="text-lg font-semibold text-foreground border-b border-border pb-2">
          Joining & Expiry
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
              Joining Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={joiningDate}
              onChange={(e) => setJoiningDate(e.target.value)}
              className="w-full h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
              Offer Expiry Date
            </label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
              Probation Period (Days)
            </label>
            <input
              type="number"
              value={probationDays}
              onChange={(e) => setProbationDays(e.target.value)}
              className="w-full h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div className="flex items-center space-x-2 pt-6">
            <input
              type="checkbox"
              id="noticeBuyout"
              checked={noticeBuyout}
              onChange={(e) => setNoticeBuyout(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <label
              htmlFor="noticeBuyout"
              className="text-sm font-semibold text-foreground cursor-pointer"
            >
              Notice Buyout Eligible
            </label>
          </div>
        </div>
      </div>

      {/* Section 5: Benefits & Notes */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-subtle space-y-4">
        <h3 className="text-lg font-semibold text-foreground border-b border-border pb-2">
          Benefits & Notes
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
              Benefits Notes
            </label>
            <textarea
              value={benefitsNotes}
              onChange={(e) => setBenefitsNotes(e.target.value)}
              placeholder="e.g. Health Insurance, Free Lunch, Gym membership..."
              rows={3}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
              Offer Notes
            </label>
            <textarea
              value={offerNotes}
              onChange={(e) => setOfferNotes(e.target.value)}
              placeholder="Internal notes regarding negotiation or special terms..."
              rows={3}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
              Offer PDF Key / Storage Path
            </label>
            <input
              type="text"
              value={offerPdfKey}
              onChange={(e) => setOfferPdfKey(e.target.value)}
              placeholder="e.g. offers/candidate_123_offer.pdf"
              className="w-full h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex justify-end space-x-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isPending}
          className="font-semibold shadow-subtle"
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isPending} className="font-semibold shadow-subtle">
          {isPending ? "Saving..." : mode === "create" ? "Create Offer" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
