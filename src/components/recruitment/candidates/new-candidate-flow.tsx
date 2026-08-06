"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FileText } from "lucide-react";
import {
  AddCandidateMethodChooser,
  type AddCandidateMethod,
} from "@/components/recruitment/candidates/add-candidate-method-chooser";
import { CandidateForm, type EmployeeOption } from "@/components/recruitment/candidates/candidate-form";
import { ResumeUploadPanel } from "@/components/recruitment/candidates/resume-upload-panel";
import { ResumeParsingPlaceholder } from "@/components/recruitment/candidates/resume-parsing-placeholder";
import { SectionCard } from "@/components/ui/section-card";

type FlowStep = "choose" | "manual" | "upload" | "parsing";

const PENDING_RESUME_KEY = "recruitment:pending-resume-meta";

type PendingResumeMeta = {
  fileName: string;
  fileSize: number;
  mimeType: string;
  selectedAt: string;
};

function parseStep(method: string | null, from: string | null): FlowStep {
  if (method === "manual") return "manual";
  if (method === "upload") return "upload";
  if (method === "parsing") return "parsing";
  if (from === "resume") return "manual";
  return "choose";
}

function writePendingResumeMeta(file: File) {
  // TODO(resume-parser): replace sessionStorage metadata with a server-side
  // intake draft (file storage key + parse job id). Do not create Candidate here.
  const meta: PendingResumeMeta = {
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
    selectedAt: new Date().toISOString(),
  };
  try {
    sessionStorage.setItem(PENDING_RESUME_KEY, JSON.stringify(meta));
  } catch {
    // Ignore quota / private-mode failures — UI flow still continues.
  }
}

function readPendingResumeMeta(): PendingResumeMeta | null {
  try {
    const raw = sessionStorage.getItem(PENDING_RESUME_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingResumeMeta;
  } catch {
    return null;
  }
}

export function NewCandidateFlow({ employees }: { employees: EmployeeOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const methodParam = searchParams.get("method");
  const fromParam = searchParams.get("from");
  const [step, setStep] = useState<FlowStep>(() => parseStep(methodParam, fromParam));
  const [file, setFile] = useState<File | null>(null);
  const [pendingMeta, setPendingMeta] = useState<PendingResumeMeta | null>(null);

  useEffect(() => {
    setStep(parseStep(methodParam, fromParam));
  }, [methodParam, fromParam]);

  useEffect(() => {
    if (fromParam === "resume" || methodParam === "manual") {
      setPendingMeta(readPendingResumeMeta());
    }
  }, [fromParam, methodParam]);

  const replaceQuery = useCallback(
    (next: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(next)) {
        if (value == null) params.delete(key);
        else params.set(key, value);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  function goToStep(next: FlowStep, query: Record<string, string | null>) {
    setStep(next);
    replaceQuery(query);
  }

  function handleMethodSelect(method: AddCandidateMethod) {
    if (method === "manual") {
      goToStep("manual", { method: "manual", from: null });
      return;
    }
    goToStep("upload", { method: "upload", from: null });
  }

  function handleUploadContinue() {
    if (!file) return;
    writePendingResumeMeta(file);
    setPendingMeta({
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      selectedAt: new Date().toISOString(),
    });
    // TODO(resume-parser): start parse job here, then route to Review instead of placeholder.
    goToStep("parsing", { method: "parsing", from: null });
  }

  function handleContinueToForm() {
    goToStep("manual", { method: "manual", from: "resume" });
  }

  if (step === "choose") {
    return (
      <SectionCard>
        <AddCandidateMethodChooser onSelect={handleMethodSelect} />
      </SectionCard>
    );
  }

  if (step === "upload") {
    return (
      <ResumeUploadPanel
        file={file}
        onFileChange={setFile}
        showSuccess={Boolean(file)}
        onBack={() => {
          setFile(null);
          goToStep("choose", { method: null, from: null });
        }}
        onContinue={handleUploadContinue}
      />
    );
  }

  if (step === "parsing") {
    const name = file?.name ?? pendingMeta?.fileName ?? "resume";
    return (
      <ResumeParsingPlaceholder
        fileName={name}
        onBackToUpload={() => goToStep("upload", { method: "upload", from: null })}
        onContinueToForm={handleContinueToForm}
      />
    );
  }

  return (
    <div className="space-y-4">
      {fromParam === "resume" && pendingMeta && (
        <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/20 px-4 py-3 text-sm">
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="font-semibold text-foreground">Resume selected — manual entry</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {/* TODO(resume-parser): prefill CandidateForm from extracted draft mapped fields */}
              <span className="truncate font-medium text-foreground/80">{pendingMeta.fileName}</span>
              {" · "}
              Auto-fill from resume is not available yet. Complete the form below. No candidate was
              created from the upload step.
            </p>
          </div>
        </div>
      )}
      <CandidateForm mode="create" employees={employees} />
    </div>
  );
}
