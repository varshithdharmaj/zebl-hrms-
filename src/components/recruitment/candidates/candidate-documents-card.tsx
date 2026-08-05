"use client";

import React, { useState } from "react";
import { FileText, UploadCloud, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CandidateSection } from "./candidate-section";
import { CandidateDocumentTable } from "./candidate-document-table";
import { CandidateUploadDialog } from "./candidate-upload-dialog";

export interface CandidateDocumentsCardProps {
  candidateId: string;
  documents: any[];
}

export function CandidateDocumentsCard({ candidateId, documents }: CandidateDocumentsCardProps) {
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  return (
    <CandidateSection
      title="Documents"
      description="Manage candidate resumes, cover letters, portfolios, and other attachments."
      action={
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsUploadOpen(true)}
          className="font-semibold shadow-subtle flex items-center gap-1.5"
        >
          <Plus className="h-4 w-4 text-muted-foreground" />
          Upload Document
        </Button>
      }
    >
      <CandidateDocumentTable documents={documents} candidateId={candidateId} />

      <CandidateUploadDialog
        isOpen={isUploadOpen}
        onOpenChange={setIsUploadOpen}
        candidateId={candidateId}
      />
    </CandidateSection>
  );
}
