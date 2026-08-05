"use client";

import React, { useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitInterviewFeedbackAction } from "@/actions/recruitment-interviews";
import { Button } from "@/components/ui/button";

interface FeedbackFormProps {
  interviewId: string;
  applicationId: string;
  onSuccess?: () => void;
}

export function FeedbackForm({ interviewId, applicationId, onSuccess }: FeedbackFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = React.useState<string | null>(null);

  // Feedback fields
  const [overallRating, setOverallRating] = React.useState<number>(3);
  const [recommendation, setRecommendation] = React.useState<string>("hire");
  const [strengths, setStrengths] = React.useState("");
  const [concerns, setConcerns] = React.useState("");
  const [privateNotes, setPrivateNotes] = React.useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!strengths.trim()) {
      setError("Please describe the candidate's strengths.");
      return;
    }

    const payload = {
      interviewId,
      applicationId,
      overallRating,
      recommendation,
      strengths,
      concerns,
      privateNotes,
    };

    startTransition(async () => {
      const res = await submitInterviewFeedbackAction({}, payload);
      if (res.error) {
        setError(res.error);
      } else {
        if (onSuccess) {
          onSuccess();
        } else {
          router.refresh();
        }
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
            Overall Rating (1 - 5)
          </label>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((num) => (
              <button
                type="button"
                key={num}
                onClick={() => setOverallRating(num)}
                className={`h-9 w-9 rounded-lg border font-bold text-sm transition-all ${
                  overallRating === num
                    ? "bg-primary border-primary text-white shadow-subtle"
                    : "border-border hover:bg-muted/15 text-foreground"
                }`}
              >
                {num}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
            Recommendation
          </label>
          <select
            value={recommendation}
            onChange={(e) => setRecommendation(e.target.value)}
            className="w-full h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-semibold"
          >
            <option value="strong_hire">Strong Hire</option>
            <option value="hire">Hire</option>
            <option value="lean_hire">Lean Hire</option>
            <option value="no_hire">No Hire</option>
            <option value="strong_no_hire">Strong No Hire</option>
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
            Strengths
          </label>
          <textarea
            value={strengths}
            onChange={(e) => setStrengths(e.target.value)}
            placeholder="What did the candidate do well? Mention technical skills, communication, etc..."
            rows={3}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
            Concerns / Weaknesses
          </label>
          <textarea
            value={concerns}
            onChange={(e) => setConcerns(e.target.value)}
            placeholder="Any areas of concern, gaps in knowledge, or red flags..."
            rows={3}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
            Private Notes (Optional)
          </label>
          <textarea
            value={privateNotes}
            onChange={(e) => setPrivateNotes(e.target.value)}
            placeholder="Notes only visible to HR and Recruiters..."
            rows={2}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        <Button
          type="submit"
          disabled={isPending}
          className="font-semibold text-xs h-9 rounded-lg shadow-subtle w-full sm:w-auto"
        >
          {isPending ? "Submitting..." : "Submit Feedback Scorecard"}
        </Button>
      </div>
    </form>
  );
}
