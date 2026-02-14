/**
 * Coach report service — calls /api/ai/report with structured scan payload.
 * No image data is sent. Only computed signals.
 */

import type {
  ScanCategory,
  PoseDirection,
  AnalysisScores,
  CoachConfidence,
} from "../models/types";
import { getCoachConfidence } from "../models/types";

export interface CoachPayload {
  category: ScanCategory;
  poseDirection: PoseDirection;
  timeGapDays: number | null;
  trackedRegions: string[];
  scores: AnalysisScores;
  metrics: {
    shoulderIndex?: number;
    hipIndex?: number;
    vTaperIndex?: number;
    symmetryScore?: number;
  };
  tips: string[];
  confidence: CoachConfidence;
}

export async function generateCoachReport(
  payload: CoachPayload
): Promise<string> {
  const response = await fetch("/api/ai/report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ coachPayload: payload }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `API error: ${response.status}`);
  }

  const data = await response.json();
  return data.report as string;
}

/** Build a CoachPayload from analysis results + previous scan context */
export function buildCoachPayload(opts: {
  category: ScanCategory;
  poseDirection: PoseDirection;
  trackedRegions: string[];
  scores: AnalysisScores;
  tips: string[];
  shoulderIndex?: number;
  hipIndex?: number;
  vTaperIndex?: number;
  symmetryScore?: number;
  prevTimestamp?: number;
}): CoachPayload {
  const timeGapDays = opts.prevTimestamp
    ? Math.floor((Date.now() - opts.prevTimestamp) / 86400000)
    : null;

  return {
    category: opts.category,
    poseDirection: opts.poseDirection,
    timeGapDays,
    trackedRegions: opts.trackedRegions,
    scores: opts.scores,
    metrics: {
      shoulderIndex: opts.shoulderIndex,
      hipIndex: opts.hipIndex,
      vTaperIndex: opts.vTaperIndex,
      symmetryScore: opts.symmetryScore,
    },
    tips: opts.tips,
    confidence: getCoachConfidence(opts.scores.quality, timeGapDays),
  };
}
