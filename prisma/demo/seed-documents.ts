import { RecruitmentDocumentType } from "@/generated/prisma/client";
import type { DemoSeedContext } from "./context";
import { chunk, daysAgo, logStep } from "./helpers";

export async function seedDocuments(ctx: DemoSeedContext): Promise<void> {
  logStep("Seeding candidate documents…");
  const { prisma, candidates, rng } = ctx;
  let count = 0;

  for (const batch of chunk(candidates, 40)) {
    await prisma.$transaction(async (tx) => {
      for (const cand of batch) {
        await tx.candidateDocument.deleteMany({ where: { candidateId: cand.id } });

        const docs: Array<{
          documentType: RecruitmentDocumentType;
          fileName: string;
          mimeType: string;
          sizeBytes: number;
          isPrimary: boolean;
        }> = [
          {
            documentType: RecruitmentDocumentType.resume,
            fileName: `${cand.fullName.replace(/\s+/g, "_")}_Resume.pdf`,
            mimeType: "application/pdf",
            sizeBytes: 180_000 + cand.index * 137,
            isPrimary: true,
          },
          {
            documentType: RecruitmentDocumentType.portfolio,
            fileName: `${cand.fullName.replace(/\s+/g, "_")}_Portfolio.pdf`,
            mimeType: "application/pdf",
            sizeBytes: 420_000 + cand.index * 211,
            isPrimary: false,
          },
          {
            documentType: RecruitmentDocumentType.other,
            fileName: `${cand.fullName.replace(/\s+/g, "_")}_Certificates.pdf`,
            mimeType: "application/pdf",
            sizeBytes: 95_000 + cand.index * 97,
            isPrimary: false,
          },
        ];

        if (cand.index % 5 === 0) {
          docs.push({
            documentType: RecruitmentDocumentType.offer_letter,
            fileName: `${cand.fullName.replace(/\s+/g, "_")}_Offer_Draft.pdf`,
            mimeType: "application/pdf",
            sizeBytes: 110_000,
            isPrimary: false,
          });
        }

        if (cand.index % 7 === 0) {
          docs.push({
            documentType: RecruitmentDocumentType.cover_letter,
            fileName: `${cand.fullName.replace(/\s+/g, "_")}_CoverLetter.pdf`,
            mimeType: "application/pdf",
            sizeBytes: 64_000,
            isPrimary: false,
          });
        }

        for (const d of docs) {
          const storageKey = `demo/candidates/${cand.id}/documents/${d.fileName}`;
          await tx.candidateDocument.create({
            data: {
              candidateId: cand.id,
              documentType: d.documentType,
              fileName: d.fileName,
              mimeType: d.mimeType,
              sizeBytes: d.sizeBytes,
              size: d.sizeBytes,
              storageKey,
              storagePath: storageKey,
              fileType: "pdf",
              checksum: `demo-checksum-${cand.index}-${d.documentType}`,
              isPrimary: d.isPrimary,
              uploadedByUserId: cand.primaryRecruiterUserId,
              createdAt: daysAgo(5 + Math.floor(rng() * 40), 14),
            },
          });
          count += 1;
        }
      }
    });
  }

  ctx.counts.documents = count;
  logStep(`Documents ready (${count}).`);
}
