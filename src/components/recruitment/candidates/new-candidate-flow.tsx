"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  AddCandidateMethodChooser,
  type AddCandidateMethod,
} from "@/components/recruitment/candidates/add-candidate-method-chooser";
import { CandidateForm, type EmployeeOption } from "@/components/recruitment/candidates/candidate-form";
import { ResumeUploadPanel } from "@/components/recruitment/candidates/resume-upload-panel";
import { NewCandidateResumeReview } from "@/components/recruitment/candidates/new-candidate-resume-review";
import { SectionCard } from "@/components/ui/section-card";
import { Button } from "@/components/ui/button";
import { parseResumeForNewCandidateAction } from "@/actions/recruitment-new-candidate-resume";
import type { NewCandidateResumeReviewDraft } from "@/lib/recruitment/services/create-candidate-from-resume-service";

/**
 * idle      — method chooser (or "manual" branch, a sibling exit from the linear lifecycle)
 * uploading — file picked, not yet submitted to the single-pass parser
 * processing — one request: file upload + Gemini extraction + insight generation
 * review    — three-pane review; recruiter edits are local state only, never re-trigger processing
 * (submitting/submitted live inside the review component itself, via useTransition + redirect)
 */
type FlowStep = "idle" | "manual" | "uploading" | "processing" | "review";

const STEP_QUERY: Record<Exclude<FlowStep, "idle">, string> = {
  manual: "manual",
  uploading: "upload",
  processing: "parsing",
  review: "review",
};

function parseStep(method: string | null): FlowStep {
  if (method === "manual") return "manual";
  if (method === "upload") return "uploading";
  if (method === "parsing") return "processing";
  if (method === "review") return "review";
  return "idle";
}

export function NewCandidateFlow({ employees }: { employees: EmployeeOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const methodParam = searchParams.get("method");
  const [step, setStep] = useState<FlowStep>(() => parseStep(methodParam));
  const [file, setFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<NewCandidateResumeReviewDraft | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setStep(parseStep(methodParam));
  }, [methodParam]);

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

  function goToStep(next: FlowStep) {
    setStep(next);
    replaceQuery({ method: next === "idle" ? null : STEP_QUERY[next] });
  }

  function handleMethodSelect(method: AddCandidateMethod) {
    goToStep(method === "manual" ? "manual" : "uploading");
  }

  function handleUploadContinue() {
    if (!file) return;
    setParseError(null);
    goToStep("processing");

    startTransition(async () => {
      const formData = new FormData();
      formData.set("file", file);
      // Single request: upload + Gemini single-pass extraction + insight generation.
      const result = await parseResumeForNewCandidateAction(formData);
      if (result.error || !result.draft) {
        setParseError(result.error ?? "Failed to analyze resume.");
        return;
      }
      setDraft(result.draft);
      goToStep("review");
    });
  }

  if (step === "idle") {
    return (
      <SectionCard>
        <AddCandidateMethodChooser onSelect={handleMethodSelect} />
      </SectionCard>
    );
  }

  if (step === "uploading") {
    return (
      <ResumeUploadPanel
        file={file}
        onFileChange={setFile}
        showSuccess={Boolean(file)}
        onBack={() => {
          setFile(null);
          setDraft(null);
          goToStep("idle");
        }}
        onContinue={handleUploadContinue}
      />
    );
  }

  if (step === "processing") {
    return (
      <SectionCard
        title="Analyzing resume"
        description="Sending the document to our AI resume parser for structured extraction and screening insights."
      >
        <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 py-6 text-center">
          {parseError ? (
            <>
              <p className="text-sm text-danger" role="alert">
                {parseError}
              </p>
              <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-center">
                <Button type="button" variant="outline" onClick={() => goToStep("uploading")}>
                  Back to upload
                </Button>
                <Button type="button" onClick={() => goToStep("manual")}>
                  Enter details manually
                </Button>
              </div>
            </>
          ) : (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
              <p className="text-sm font-semibold text-foreground">
                Reading document and generating insights...
              </p>
              <p className="text-xs text-muted-foreground">{file?.name ?? "Resume"}</p>
              {pending ? null : <p className="text-xs text-muted-foreground">Starting…</p>}
            </>
          )}
        </div>
      </SectionCard>
    );
  }

  if (step === "review" && draft) {
    return (
      <NewCandidateResumeReview
        draft={draft}
        file={file}
        onBack={() => {
          setDraft(null);
          goToStep("uploading");
        }}
        onContinueManual={() => goToStep("manual")}
      />
    );
  }

  return (
    <div className="space-y-4">
      <CandidateForm mode="create" employees={employees} />
    </div>
  );
}
