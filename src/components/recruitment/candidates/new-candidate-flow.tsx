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

type FlowStep = "choose" | "manual" | "upload" | "parsing" | "review";

function parseStep(method: string | null): FlowStep {
  if (method === "manual") return "manual";
  if (method === "upload") return "upload";
  if (method === "parsing") return "parsing";
  if (method === "review") return "review";
  return "choose";
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

  function goToStep(next: FlowStep, query: Record<string, string | null>) {
    setStep(next);
    replaceQuery(query);
  }

  function handleMethodSelect(method: AddCandidateMethod) {
    if (method === "manual") {
      goToStep("manual", { method: "manual" });
      return;
    }
    goToStep("upload", { method: "upload" });
  }

  function handleUploadContinue() {
    if (!file) return;
    setParseError(null);
    goToStep("parsing", { method: "parsing" });

    startTransition(async () => {
      const formData = new FormData();
      formData.set("file", file);
      const result = await parseResumeForNewCandidateAction(formData);
      if (result.error || !result.draft) {
        setParseError(result.error ?? "Failed to analyze resume.");
        return;
      }
      setDraft(result.draft);
      goToStep("review", { method: "review" });
    });
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
          setDraft(null);
          goToStep("choose", { method: null });
        }}
        onContinue={handleUploadContinue}
      />
    );
  }

  if (step === "parsing") {
    return (
      <SectionCard
        title="Extracting candidate information"
        description="Reading the resume with the deterministic parser. This is not AI analysis."
      >
        <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 py-6 text-center">
          {parseError ? (
            <>
              <p className="text-sm text-danger" role="alert">
                {parseError}
              </p>
              <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-center">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => goToStep("upload", { method: "upload" })}
                >
                  Back to upload
                </Button>
                <Button
                  type="button"
                  onClick={() => goToStep("manual", { method: "manual" })}
                >
                  Enter details manually
                </Button>
              </div>
            </>
          ) : (
            <>
              <Loader2
                className="h-8 w-8 animate-spin text-muted-foreground"
                aria-hidden
              />
              <p className="text-sm font-semibold text-foreground">
                Extracting candidate information...
              </p>
              <p className="text-xs text-muted-foreground">
                {file?.name ?? "Resume"}
              </p>
              {pending ? null : (
                <p className="text-xs text-muted-foreground">Starting…</p>
              )}
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
        onBack={() => {
          setDraft(null);
          goToStep("upload", { method: "upload" });
        }}
        onContinueManual={() => goToStep("manual", { method: "manual" })}
      />
    );
  }

  return (
    <div className="space-y-4">
      <CandidateForm mode="create" employees={employees} />
    </div>
  );
}
