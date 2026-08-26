import type { ApplicationDetail } from "@/lib/recruitment/repositories/application-repository";

/**
 * Next.js cannot serialize Prisma.Decimal from Server to Client Components.
 * `candidate.totalExperienceYears` stays a Decimal at runtime even though
 * currentCtc/expectedCtc are already plain numbers by the time they reach
 * ApplicationDetail (converted in prisma-application-repository.mapApplicationRow) —
 * this only re-normalizes the field that actually needs it, defensively
 * covering currentCtc/expectedCtc too in case that upstream conversion changes.
 */
export function sanitizeApplicationForClient(app: ApplicationDetail): ApplicationDetail {
  return {
    ...app,
    candidate: app.candidate
      ? ({
          ...app.candidate,
          totalExperienceYears:
            app.candidate.totalExperienceYears !== null &&
            app.candidate.totalExperienceYears !== undefined
              ? Number(app.candidate.totalExperienceYears)
              : null,
          currentCtc:
            app.candidate.currentCtc !== null && app.candidate.currentCtc !== undefined
              ? Number(app.candidate.currentCtc)
              : null,
          expectedCtc:
            app.candidate.expectedCtc !== null && app.candidate.expectedCtc !== undefined
              ? Number(app.candidate.expectedCtc)
              : null,
        } as unknown as ApplicationDetail["candidate"])
      : app.candidate,
  };
}

export function sanitizeApplicationsForClient(apps: readonly ApplicationDetail[]): ApplicationDetail[] {
  return apps.map(sanitizeApplicationForClient);
}
