/** Pure time-to-hire averages from conversion snapshots + related dates. */

export type TimeToHireConversionInput = {
  applicationCreatedAt: Date;
  convertedAt: Date;
  firstInterviewAt: Date | null;
  offerSentAt: Date | null;
  offerAcceptedAt: Date | null;
};

export type TimeToHireMetrics = {
  applicationToInterview: number | null;
  interviewToOffer: number | null;
  offerToHire: number | null;
  totalTimeToHire: number | null;
  sampleSize: number;
};

export function dayDelta(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)));
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

/**
 * Definition (Recruitment V1):
 * - Total TTH = application.createdAt → conversion.convertedAt
 * - Segments use first interview scheduledStart + offer sent/accepted when present
 */
export function computeTimeToHireMetrics(
  rows: readonly TimeToHireConversionInput[]
): TimeToHireMetrics {
  if (rows.length === 0) {
    return {
      applicationToInterview: null,
      interviewToOffer: null,
      offerToHire: null,
      totalTimeToHire: null,
      sampleSize: 0,
    };
  }

  const appToInterview: number[] = [];
  const interviewToOffer: number[] = [];
  const offerToHire: number[] = [];
  const totalTth: number[] = [];

  for (const row of rows) {
    totalTth.push(dayDelta(row.applicationCreatedAt, row.convertedAt));

    if (row.firstInterviewAt) {
      appToInterview.push(dayDelta(row.applicationCreatedAt, row.firstInterviewAt));
      if (row.offerSentAt) {
        interviewToOffer.push(dayDelta(row.firstInterviewAt, row.offerSentAt));
      }
    }
    if (row.offerAcceptedAt) {
      offerToHire.push(dayDelta(row.offerAcceptedAt, row.convertedAt));
    }
  }

  return {
    applicationToInterview: average(appToInterview),
    interviewToOffer: average(interviewToOffer),
    offerToHire: average(offerToHire),
    totalTimeToHire: average(totalTth),
    sampleSize: rows.length,
  };
}
