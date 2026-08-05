import {
  InterviewRoundType,
  InterviewStatus,
  RecruitmentPipelineStage,
  RecruitmentTimelineEntityType,
} from "@/generated/prisma/client";
import type { DemoInterviewRef, DemoSeedContext } from "./context";
import { addHours, chunk, daysAgo, daysFromNow, demoMeta, logStep, pick } from "./helpers";

const INTERVIEW_STAGES = new Set<string>([
  RecruitmentPipelineStage.screening,
  RecruitmentPipelineStage.assessment,
  RecruitmentPipelineStage.hr_round,
  RecruitmentPipelineStage.technical_round,
  RecruitmentPipelineStage.team_lead_round,
  RecruitmentPipelineStage.manager_round,
  RecruitmentPipelineStage.client_round,
  RecruitmentPipelineStage.decision,
  RecruitmentPipelineStage.offer,
  RecruitmentPipelineStage.hired,
  RecruitmentPipelineStage.rejected,
]);

export async function seedInterviews(ctx: DemoSeedContext): Promise<void> {
  logStep("Seeding interviews + feedback…");
  const { prisma, rng, applications, actors, jobs } = ctx;
  const eligible = applications.filter((a) => INTERVIEW_STAGES.has(a.currentStage));
  const interviews: DemoInterviewRef[] = [];
  let feedbackCount = 0;

  const roundCycle: InterviewRoundType[] = [
    InterviewRoundType.screening,
    InterviewRoundType.technical,
    InterviewRoundType.manager,
    InterviewRoundType.hr,
    InterviewRoundType.client,
  ];

  const statusCycle: InterviewStatus[] = [
    InterviewStatus.scheduled,
    InterviewStatus.completed,
    InterviewStatus.completed,
    InterviewStatus.no_show,
    InterviewStatus.cancelled,
    InterviewStatus.completed,
    InterviewStatus.draft,
  ];

  for (const batch of chunk(eligible, 30)) {
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < batch.length; i++) {
        const app = batch[i]!;
        await tx.interview.deleteMany({ where: { applicationId: app.id } });

        const rounds = 1 + (app.id.charCodeAt(0) % 3);
        for (let r = 0; r < rounds; r++) {
          const roundType = roundCycle[(i + r) % roundCycle.length]!;
          const status = statusCycle[(i + r * 3) % statusCycle.length]!;
          const start =
            status === InterviewStatus.scheduled || status === InterviewStatus.draft
              ? daysFromNow(2 + ((i + r) % 10), 11 + (r % 4))
              : daysAgo(5 + ((i + r) % 40), 11 + (r % 4));
          const end = addHours(start, 1);

          const panelist =
            roundType === InterviewRoundType.hr
              ? actors.hr_manager
              : roundType === InterviewRoundType.technical
                ? actors.eng_manager
                : roundType === InterviewRoundType.client
                  ? actors.product_manager
                  : actors.hiring_manager;

          const interview = await tx.interview.create({
            data: {
              applicationId: app.id,
              roundType,
              status,
              title: `${roundType.replace(/_/g, " ")} interview`,
              scheduledStart: start,
              scheduledEnd: end,
              timezone: "Asia/Kolkata",
              location: pick(rng, ["Zoom", "Teams", "Hyderabad HQ - Conf Room A", "Bangalore - 4F"]),
              meetingUrl:
                status === InterviewStatus.cancelled
                  ? null
                  : `https://meet.zebl.demo/i/${app.id.slice(0, 8)}-${r}`,
              summary:
                status === InterviewStatus.completed
                  ? "Solid discussion covering fundamentals, problem solving, and collaboration style."
                  : null,
              createdByUserId: app.assignedRecruiterUserId,
              createdAt: daysAgo(8 + r, 9),
            },
          });

          await tx.interviewPanelist.create({
            data: {
              interviewId: interview.id,
              employeeId: panelist.employeeId,
              isObserver: false,
            },
          });

          // Second panelist for technical rounds
          if (roundType === InterviewRoundType.technical) {
            await tx.interviewPanelist.create({
              data: {
                interviewId: interview.id,
                employeeId: actors.qa_manager.employeeId,
                isObserver: true,
              },
            });
          }

          if (status === InterviewStatus.completed) {
            const rating = Math.round((2.5 + rng() * 2.5) * 10) / 10;
            const recommendation = pick(rng, [
              "strong_hire",
              "hire",
              "hire",
              "borderline",
              "no_hire",
            ]);
            const qualitative =
              rating >= 4.2
                ? "Excellent"
                : rating >= 3.2
                  ? "Average"
                  : "Poor";

            await tx.interviewFeedback.create({
              data: {
                interviewId: interview.id,
                authorEmployeeId: panelist.employeeId,
                overallRating: rating,
                ratingsJson: {
                  technical: rating,
                  communication: Math.max(1, rating - 0.3 + rng() * 0.6),
                  culture: Math.max(1, rating - 0.2 + rng() * 0.5),
                  qualitative,
                },
                recommendation,
                strengths: pick(rng, [
                  "Clear ownership and structured thinking",
                  "Strong system design instincts",
                  "Great collaboration examples",
                  "Deep domain knowledge",
                ]),
                concerns:
                  recommendation === "no_hire"
                    ? "Gaps in fundamentals relative to bar"
                    : recommendation === "borderline"
                      ? "Needs stronger evidence of senior-level impact"
                      : null,
                privateNotes: "[Demo] Panel notes for internal debrief only.",
                submittedAt: addHours(end, 2),
              },
            });
            feedbackCount += 1;

            await tx.interviewAttachment.create({
              data: {
                interviewId: interview.id,
                fileName: "scorecard.pdf",
                mimeType: "application/pdf",
                sizeBytes: 48_000,
                storageKey: `demo/interviews/${interview.id}/scorecard.pdf`,
                uploadedByUserId: app.assignedRecruiterUserId,
              },
            });
          }

          const job = jobs.find((j) => j.id === app.jobOpeningId);
          await tx.recruitmentTimelineEvent.create({
            data: {
              entityType: RecruitmentTimelineEntityType.interview,
              entityId: interview.id,
              applicationId: app.id,
              candidateId: app.candidateId,
              jobOpeningId: app.jobOpeningId,
              eventType: `interview.${status}`,
              summary: `${roundType} interview ${status}${job ? ` for ${job.title}` : ""}`,
              actorUserId: app.assignedRecruiterUserId,
              metadata: demoMeta({ roundType, status }),
              createdAt: interview.createdAt,
            },
          });

          interviews.push({
            id: interview.id,
            applicationId: app.id,
            status,
            roundType,
          });
        }
      }
    });
  }

  ctx.interviews = interviews;
  ctx.counts.interviews = interviews.length;
  ctx.counts.interviewFeedback = feedbackCount;
  logStep(`Interviews ready (${interviews.length}, feedback=${feedbackCount}).`);
}
