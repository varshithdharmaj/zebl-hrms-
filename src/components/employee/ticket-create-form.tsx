"use client";

import { useActionState, useState } from "react";
import { createTicketAction, type TicketActionState } from "@/actions/tickets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionCard } from "@/components/ui/section-card";
import { ErrorAlert } from "@/components/ui/error-alert";
import { AlertTriangle, Info } from "lucide-react";

const initialState: TicketActionState = {};

const CATEGORIES = [
  { value: "attendance", label: "Attendance" },
  { value: "leave", label: "Leave" },
  { value: "payroll", label: "Payroll" },
  { value: "salary", label: "Salary" },
  { value: "it_technical", label: "IT / Technical" },
  { value: "hr", label: "HR" },
  { value: "workplace", label: "Workplace" },
  { value: "facilities", label: "Facilities" },
  { value: "suggestion", label: "Suggestion" },
  { value: "other", label: "Other" },
];

const TYPES = [
  { value: "complaint", label: "Complaint" },
  { value: "service_request", label: "Service Request" },
  { value: "suggestion", label: "Suggestion" },
  { value: "meeting_request", label: "Meeting Request" },
  { value: "anonymous_complaint", label: "Anonymous Complaint" },
  { value: "other", label: "Other" },
];

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

export function TicketCreateForm() {
  const [state, formAction, pending] = useActionState(createTicketAction, initialState);
  const [category, setCategory] = useState("other");
  const [type, setType] = useState("service_request");
  const [priority, setPriority] = useState("medium");
  const [isAnonymous, setIsAnonymous] = useState(false);

  return (
    <SectionCard
      title="Ticket Details"
      description="Provide as much detail as possible to help us resolve your request quickly."
    >
      <form action={formAction} className="max-w-2xl space-y-6">
        <input type="hidden" name="category" value={category} />
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="priority" value={priority} />
        <input type="hidden" name="isAnonymous" value={isAnonymous ? "true" : "false"} />

        {state.error && <ErrorAlert message={state.error} />}

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="subject" className="text-xs font-semibold text-slate-700">
            Concern Raised / Subject
          </Label>
          <Input
            id="subject"
            name="subject"
            type="text"
            required
            placeholder="Brief summary of your concern"
            maxLength={200}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description" className="text-xs font-semibold text-slate-700">
            Detailed Description
          </Label>
          <Textarea
            id="description"
            name="description"
            required
            placeholder="Provide as much detail as possible..."
            rows={6}
            maxLength={5000}
          />
          <p className="text-xs text-muted-foreground">
            Include relevant dates, names, or other information that will help us assist you.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-700">Priority</Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITIES.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="isAnonymous"
              name="isAnonymousCheckbox"
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex-1">
              <Label htmlFor="isAnonymous" className="cursor-pointer text-xs font-semibold text-slate-700">
                Submit as Anonymous Complaint
              </Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Your identity will be hidden
              </p>
            </div>
          </div>

          {isAnonymous && (
            <div className="flex gap-2 rounded-md bg-amber-50 p-3 text-xs text-amber-800">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <p>
                <strong>Important:</strong> Anonymous complaints can only be accessed by Super Admin.
                HR users and HR managers cannot view anonymous complaints or your identity.
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-2 rounded-md bg-blue-50 p-3 text-xs text-blue-800">
          <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <p>
            You'll receive updates via this portal when HR responds to your ticket. Check "My Tickets" regularly for updates.
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Submitting..." : "Submit Ticket"}
          </Button>
          <Button type="button" variant="outline" asChild>
            <a href="/employee/tickets">Cancel</a>
          </Button>
        </div>
      </form>
    </SectionCard>
  );
}
