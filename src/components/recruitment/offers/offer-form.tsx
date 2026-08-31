"use client";

import React, { useTransition } from "react";
import { useRouter } from "next/navigation";
import { createOfferAction, updateOfferAction } from "@/actions/recruitment-offers";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Offer } from "@/generated/prisma/client";

export interface OfferFormApplicationOption {
  id: string;
  candidate: {
    firstName?: string | null;
    lastName?: string | null;
    fullName?: string | null;
  };
  jobOpening: {
    title?: string | null;
  };
  hasApprovedDecision?: boolean;
}

/**
 * Healthcare RCM Preset Constants
 */
const DEPARTMENT_PRESETS = [
  "Medical Coding",
  "Billing & Collections",
  "Accounts Receivable (AR)",
  "Client Operations",
  "Software Engineering",
  "HR & Talent",
  "Finance & Compliance",
];

const LOCATION_PRESETS = ["Hyderabad"];

const GRADE_PRESETS = [
  { value: "L1", label: "L1 - Trainee / Associate" },
  { value: "L2", label: "L2 - Senior Specialist" },
  { value: "L3", label: "L3 - Team Lead / Supervisor" },
  { value: "L4", label: "L4 - Operations Manager" },
  { value: "L5", label: "L5 - Director / Executive" },
];

/**
 * Edit defaults — fields this form reads from a serialized offer
 * (RSC → client; Prisma.Decimal already flattened to string/number).
 */
export type OfferFormValues = Pick<
  Offer,
  | "id"
  | "applicationId"
  | "employmentType"
  | "department"
  | "location"
  | "grade"
  | "reportingManagerId"
  | "currency"
  | "stock"
  | "probationDays"
  | "noticeBuyout"
  | "offerPdfKey"
  | "offerNotes"
  | "benefitsNotes"
> & {
  baseSalary: string | number;
  variablePay?: string | number | null;
  bonus?: string | number | null;
  ctc?: string | number | null;
  joiningDate?: string | Date | null;
  expiresAt?: string | Date | null;
  salaryBreakdownJson?: unknown;
  application?: {
    candidate?: {
      firstName?: string | null;
      lastName?: string | null;
    } | null;
    jobOpening?: {
      title?: string | null;
    } | null;
  } | null;
};

interface OfferFormProps {
  mode: "create" | "edit";
  offer?: OfferFormValues;
  applicationId?: string;
  applications?: OfferFormApplicationOption[];
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
  const [showDecisionDialog, setShowDecisionDialog] = React.useState(false);

  // Form states
  const [selectedAppId, setSelectedAppId] = React.useState(
    offer?.applicationId ?? applicationId ?? applications[0]?.id ?? ""
  );
  const [employmentType, setEmploymentType] = React.useState(offer?.employmentType ?? "Full-time");

  // Department presets & custom handling
  const initialDept = offer?.department ?? "Medical Coding";
  const isDeptPreset = DEPARTMENT_PRESETS.includes(initialDept);
  const [deptSelect, setDeptSelect] = React.useState<string>(
    isDeptPreset ? initialDept : "__custom__"
  );
  const [customDepartment, setCustomDepartment] = React.useState<string>(
    isDeptPreset ? "" : initialDept
  );

  // Location presets & custom handling
  const initialLoc = offer?.location ?? "Hyderabad";
  const isLocPreset = LOCATION_PRESETS.includes(initialLoc);
  const [locationSelect, setLocationSelect] = React.useState<string>(
    isLocPreset ? initialLoc : "__custom__"
  );
  const [customLocation, setCustomLocation] = React.useState<string>(
    isLocPreset ? "" : initialLoc
  );

  // Grade presets & custom handling
  const initialGrade = offer?.grade ?? "L1";
  const isGradePreset = GRADE_PRESETS.some((g) => g.value === initialGrade);
  const [gradeSelect, setGradeSelect] = React.useState<string>(
    isGradePreset ? initialGrade : "__custom__"
  );
  const [customGrade, setCustomGrade] = React.useState<string>(
    isGradePreset ? "" : initialGrade
  );

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
  const [offerNotes, setOfferNotes] = React.useState(offer?.offerNotes ?? "");
  const [benefitsNotes, setBenefitsNotes] = React.useState(offer?.benefitsNotes ?? "");

  // Salary breakup (monthly) — feeds the offer letter's annexure table.
  const existingBreakdown =
    offer?.salaryBreakdownJson && typeof offer.salaryBreakdownJson === "object"
      ? (offer.salaryBreakdownJson as Record<string, unknown>)
      : null;
  const readMonthly = (key: string) => {
    const raw = existingBreakdown?.[key];
    return typeof raw === "number" ? String(raw) : "";
  };
  const [basicMonthly, setBasicMonthly] = React.useState(readMonthly("basicMonthly"));
  const [hraMonthly, setHraMonthly] = React.useState(readMonthly("hraMonthly"));
  const [conveyanceMonthly, setConveyanceMonthly] = React.useState(
    readMonthly("conveyanceMonthly")
  );
  const [medicalMonthly, setMedicalMonthly] = React.useState(readMonthly("medicalMonthly"));
  const [specialMonthly, setSpecialMonthly] = React.useState(readMonthly("specialMonthly"));

  const salaryComponents = {
    basicMonthly: parseFloat(basicMonthly) || 0,
    hraMonthly: parseFloat(hraMonthly) || 0,
    conveyanceMonthly: parseFloat(conveyanceMonthly) || 0,
    medicalMonthly: parseFloat(medicalMonthly) || 0,
    specialMonthly: parseFloat(specialMonthly) || 0,
  };
  const grossMonthly = Object.values(salaryComponents).reduce((sum, v) => sum + v, 0);
  const grossAnnual = grossMonthly * 12;
  const hasSalaryBreakup = grossMonthly > 0;
  const ctcNumber = parseFloat(ctc) || 0;
  const breakupMatchesCtc = !hasSalaryBreakup || grossAnnual === ctcNumber;

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

  // Selected application decision check
  const selectedApp = applications.find((app) => app.id === selectedAppId);
  const showDecisionWarning = selectedApp && selectedApp.hasApprovedDecision === false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedAppId) {
      setError("Please select an application.");
      return;
    }

    // Custom field resolution & validation
    const finalDepartment = deptSelect === "__custom__" ? customDepartment.trim() : deptSelect;
    if (!finalDepartment) {
      setError("Please select or enter a department.");
      return;
    }

    const finalLocation = locationSelect === "__custom__" ? customLocation.trim() : locationSelect;
    if (!finalLocation) {
      setError("Please select or enter a location.");
      return;
    }

    const finalGrade = gradeSelect === "__custom__" ? customGrade.trim() : gradeSelect;
    if (!finalGrade) {
      setError("Please select or enter a grade.");
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
      department: finalDepartment,
      location: finalLocation,
      grade: finalGrade,
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
      offerNotes: offerNotes || null,
      benefitsNotes: benefitsNotes || null,
      salaryBreakdownJson: hasSalaryBreakup ? salaryComponents : undefined,
    };

    startTransition(async () => {
      const action = mode === "create" ? createOfferAction : updateOfferAction;
      const res = await action({}, payload);

      if (res.error) {
        setError(res.error);
        if (res.error.toLowerCase().includes("hiring decision") || res.error.toLowerCase().includes("decision")) {
          setShowDecisionDialog(true);
        }
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
    <>
      <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700 font-medium">
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

            {showDecisionWarning && (
              <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs font-medium text-amber-900 flex items-center gap-2">
                <span>⚠️ This application requires an approved hiring decision before an offer can be finalized.</span>
              </div>
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

            {/* Department Dropdown + Custom Input */}
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                Department <span className="text-red-500">*</span>
              </label>
              <select
                value={deptSelect}
                onChange={(e) => setDeptSelect(e.target.value)}
                className="w-full h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {DEPARTMENT_PRESETS.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
                <option value="__custom__">+ Add Custom...</option>
              </select>
              {deptSelect === "__custom__" && (
                <input
                  type="text"
                  value={customDepartment}
                  onChange={(e) => setCustomDepartment(e.target.value)}
                  placeholder="Enter custom department..."
                  className="mt-2 w-full h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  required
                />
              )}
            </div>

            {/* Location Dropdown + Custom Input */}
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                Location <span className="text-red-500">*</span>
              </label>
              <select
                value={locationSelect}
                onChange={(e) => setLocationSelect(e.target.value)}
                className="w-full h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {LOCATION_PRESETS.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
                <option value="__custom__">+ Add Custom...</option>
              </select>
              {locationSelect === "__custom__" && (
                <input
                  type="text"
                  value={customLocation}
                  onChange={(e) => setCustomLocation(e.target.value)}
                  placeholder="Enter custom location..."
                  className="mt-2 w-full h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  required
                />
              )}
            </div>

            {/* Grade Dropdown + Custom Input */}
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                Grade <span className="text-red-500">*</span>
              </label>
              <select
                value={gradeSelect}
                onChange={(e) => setGradeSelect(e.target.value)}
                className="w-full h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {GRADE_PRESETS.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
                <option value="__custom__">+ Add Custom...</option>
              </select>
              {gradeSelect === "__custom__" && (
                <input
                  type="text"
                  value={customGrade}
                  onChange={(e) => setCustomGrade(e.target.value)}
                  placeholder="Enter custom grade..."
                  className="mt-2 w-full h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  required
                />
              )}
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

          <div className="border-t border-border pt-4 space-y-3">
            <div>
              <h4 className="text-sm font-semibold text-foreground">
                Salary Breakup (for Offer Letter Annexure)
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Enter monthly amounts. Annual figures and the letter&rsquo;s annexure table are
                calculated automatically. The total (× 12) must equal the CTC above before the
                offer letter can be generated.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3 md:grid-cols-5">
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Basic (Monthly)
                </label>
                <input
                  type="number"
                  value={basicMonthly}
                  onChange={(e) => setBasicMonthly(e.target.value)}
                  className="w-full h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                  HRA (Monthly)
                </label>
                <input
                  type="number"
                  value={hraMonthly}
                  onChange={(e) => setHraMonthly(e.target.value)}
                  className="w-full h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Conveyance (Monthly)
                </label>
                <input
                  type="number"
                  value={conveyanceMonthly}
                  onChange={(e) => setConveyanceMonthly(e.target.value)}
                  className="w-full h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Medical Allowance (Monthly)
                </label>
                <input
                  type="number"
                  value={medicalMonthly}
                  onChange={(e) => setMedicalMonthly(e.target.value)}
                  className="w-full h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Special Allowance (Monthly)
                </label>
                <input
                  type="number"
                  value={specialMonthly}
                  onChange={(e) => setSpecialMonthly(e.target.value)}
                  className="w-full h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </div>
            {hasSalaryBreakup && (
              <p
                className={`text-xs font-medium ${breakupMatchesCtc ? "text-emerald-700" : "text-red-600"}`}
              >
                Gross: {grossMonthly.toLocaleString()} / month · {grossAnnual.toLocaleString()} /
                year
                {breakupMatchesCtc
                  ? " — matches CTC."
                  : ` — does not match CTC (${ctcNumber.toLocaleString()}). Adjust the components or CTC.`}
              </p>
            )}
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
          <Button type="submit" loading={isPending} className="font-semibold shadow-subtle">
            {isPending ? "Saving…" : mode === "create" ? "Create Offer" : "Save Changes"}
          </Button>
        </div>
      </form>

      {/* Decision Required Alert Dialog */}
      <AlertDialog open={showDecisionDialog} onOpenChange={setShowDecisionDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hiring Decision Required</AlertDialogTitle>
            <AlertDialogDescription>
              A formal hiring decision (Strong Hire or Hire) must be recorded for this application before an offer can be created.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDecisionDialog(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedAppId) {
                  router.push(`/admin/recruitment/applications/${selectedAppId}`);
                }
              }}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            >
              Go to Application
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
