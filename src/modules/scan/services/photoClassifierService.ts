/**
 * Photo classifier — pure functions, no side effects.
 * Takes landmarks + brightness + alignment → category + tips + scores.
 */

import type {
  Landmark,
  ClassificationResult,
  ScanCategory,
  PoseDirection,
  AnalysisScores,
} from "../models/types";
import { LM } from "../models/types";

// ─── Visibility helpers ──────────────────────────────────────────

const VIS = 0.3; // visibility threshold for classification

function vis(lm: Landmark | undefined): boolean {
  return !!lm && lm.visibility > VIS;
}

interface BodyVisibility {
  hasNose: boolean;
  hasShoulders: boolean;
  hasHips: boolean;
  hasKnees: boolean;
  hasAnkles: boolean;
  fullBodyVisible: boolean;
  upperBodyVisible: boolean;
}

function checkVisibility(landmarks: Landmark[]): BodyVisibility {
  const hasNose = vis(landmarks[LM.NOSE]);
  const hasShoulders = vis(landmarks[LM.LEFT_SHOULDER]) && vis(landmarks[LM.RIGHT_SHOULDER]);
  const hasHips = vis(landmarks[LM.LEFT_HIP]) && vis(landmarks[LM.RIGHT_HIP]);
  const hasKnees = vis(landmarks[LM.LEFT_KNEE]) && vis(landmarks[LM.RIGHT_KNEE]);
  const hasAnkles = vis(landmarks[LM.LEFT_ANKLE]) && vis(landmarks[LM.RIGHT_ANKLE]);
  const fullBodyVisible = hasShoulders && hasHips && hasKnees && hasAnkles;
  const upperBodyVisible = hasShoulders && hasHips && !hasKnees;

  return { hasNose, hasShoulders, hasHips, hasKnees, hasAnkles, fullBodyVisible, upperBodyVisible };
}

// ─── Standing detection ──────────────────────────────────────────

function isStanding(
  landmarks: Landmark[],
  imgW: number,
  imgH: number
): boolean {
  const lHip = landmarks[LM.LEFT_HIP];
  const rHip = landmarks[LM.RIGHT_HIP];
  const lKnee = landmarks[LM.LEFT_KNEE];
  const rKnee = landmarks[LM.RIGHT_KNEE];
  const lAnkle = landmarks[LM.LEFT_ANKLE];
  const rAnkle = landmarks[LM.RIGHT_ANKLE];

  if (!vis(lHip) || !vis(rHip) || !vis(lKnee) || !vis(rKnee) || !vis(lAnkle) || !vis(rAnkle)) {
    return false;
  }

  const hipY = ((lHip.y + rHip.y) / 2) * imgH;
  const kneeY = ((lKnee.y + rKnee.y) / 2) * imgH;
  const ankleY = ((lAnkle.y + rAnkle.y) / 2) * imgH;

  // Tolerance: 10px
  if (!(ankleY > kneeY - 10 && kneeY > hipY - 10)) return false;

  // Check leg angles
  const leftAngle = legAngle(lHip, lKnee, lAnkle, imgW, imgH);
  const rightAngle = legAngle(rHip, rKnee, rAnkle, imgW, imgH);
  const avgAngle = (leftAngle + rightAngle) / 2;

  return avgAngle >= 155;
}

function legAngle(
  hip: Landmark,
  knee: Landmark,
  ankle: Landmark,
  w: number,
  h: number
): number {
  const ax = hip.x * w - knee.x * w;
  const ay = hip.y * h - knee.y * h;
  const bx = ankle.x * w - knee.x * w;
  const by = ankle.y * h - knee.y * h;
  const dot = ax * bx + ay * by;
  const magA = Math.sqrt(ax * ax + ay * ay);
  const magB = Math.sqrt(bx * bx + by * by);
  if (magA === 0 || magB === 0) return 180;
  return Math.acos(Math.min(1, Math.max(-1, dot / (magA * magB)))) * (180 / Math.PI);
}

// ─── Pose direction ──────────────────────────────────────────────

function detectPoseDirection(landmarks: Landmark[]): PoseDirection {
  // If nose is visible with decent confidence, likely facing camera = FRONT
  // If nose is not visible but shoulders/hips are, likely BACK
  const nose = landmarks[LM.NOSE];
  const hasShoulders = vis(landmarks[LM.LEFT_SHOULDER]) && vis(landmarks[LM.RIGHT_SHOULDER]);

  if (!hasShoulders) return "UNKNOWN";

  if (nose && nose.visibility > 0.4) return "FRONT";
  if (!nose || nose.visibility < 0.15) return "BACK";

  return "UNKNOWN";
}

// ─── Framing score ───────────────────────────────────────────────

function computeFramingScore(
  landmarks: Landmark[],
  imgW: number,
  imgH: number,
  body: BodyVisibility
): number {
  let score = 50; // baseline

  if (!body.hasShoulders) return 20;

  const lS = landmarks[LM.LEFT_SHOULDER];
  const rS = landmarks[LM.RIGHT_SHOULDER];

  // Body center (hip or shoulder midpoint)
  let centerX: number;
  if (body.hasHips) {
    centerX = ((landmarks[LM.LEFT_HIP].x + landmarks[LM.RIGHT_HIP].x) / 2) * imgW;
  } else {
    centerX = ((lS.x + rS.x) / 2) * imgW;
  }

  // Reward centered body (within middle 40%)
  const centerPct = Math.abs(centerX - imgW / 2) / (imgW / 2);
  if (centerPct < 0.2) score += 25;
  else if (centerPct < 0.35) score += 15;
  else score -= 10;

  // Penalize if head is cut (nose not visible or very near top)
  const nose = landmarks[LM.NOSE];
  if (!vis(nose)) {
    score -= 10;
  } else if (nose.y < 0.03) {
    score -= 15; // head nearly cut off
  }

  // Reward margin: shoulders not touching edges
  const leftEdge = Math.min(lS.x, rS.x);
  const rightEdge = Math.max(lS.x, rS.x);
  if (leftEdge > 0.05 && rightEdge < 0.95) score += 10;
  else score -= 10;

  // Reward full body in frame
  if (body.fullBodyVisible) score += 15;
  else if (body.hasHips) score += 5;

  return Math.max(0, Math.min(100, score));
}

// ─── Lighting score ──────────────────────────────────────────────

function computeLightingScore(avgBrightness: number): number {
  // Ideal range: 60-200
  if (avgBrightness >= 60 && avgBrightness <= 200) return 100;
  if (avgBrightness < 30) return 20;
  if (avgBrightness > 240) return 30;
  if (avgBrightness < 60) return 20 + ((avgBrightness - 30) / 30) * 80;
  // > 200
  return 100 - ((avgBrightness - 200) / 40) * 70;
}

// ─── Main classifier ────────────────────────────────────────────

export function classifyPhoto(
  landmarks: Landmark[],
  imgWidth: number,
  imgHeight: number,
  avgBrightness: number,
  alignmentScore: number
): ClassificationResult {
  const body = checkVisibility(landmarks);
  const standing = body.fullBodyVisible ? isStanding(landmarks, imgWidth, imgHeight) : false;
  const poseDirection = detectPoseDirection(landmarks);

  // Compute scores
  const lighting = Math.round(computeLightingScore(avgBrightness));
  const framing = Math.round(computeFramingScore(landmarks, imgWidth, imgHeight, body));
  const poseMatch = Math.round(Math.min(100, alignmentScore));

  // Quality is weighted composite
  const quality = Math.round(
    lighting * 0.25 + framing * 0.35 + poseMatch * 0.25 + (body.fullBodyVisible ? 15 : body.hasHips ? 8 : 0)
  );

  const scores: AnalysisScores = { quality, lighting, framing, poseMatch };

  // Determine category
  let category: ScanCategory;
  if (body.fullBodyVisible && standing && lighting >= 50 && poseMatch >= 60) {
    category = "CHECKIN_FULL";
  } else if (body.hasShoulders && body.hasHips && lighting >= 40) {
    category = "CHECKIN_SELFIE";
  } else {
    category = "GALLERY";
  }

  // Tracked regions
  const trackedRegions: string[] = [];
  if (category === "CHECKIN_FULL") {
    trackedRegions.push("Full body", "Shoulders", "Torso", "Legs");
  } else if (category === "CHECKIN_SELFIE") {
    trackedRegions.push("Upper body", "Shoulders");
    if (body.hasHips) trackedRegions.push("Torso proportions");
  }

  // Human-friendly tips (max 2)
  const tips: string[] = [];
  if (category !== "CHECKIN_FULL") {
    if (!body.hasAnkles || !body.hasKnees) {
      tips.push("Step back until your feet are visible for a full check-in.");
    }
    if (!standing && body.fullBodyVisible) {
      tips.push("Stand upright with straight legs for best tracking.");
    }
  }
  if (lighting < 50 && tips.length < 2) {
    tips.push("Move to brighter light or face the light source.");
  }
  if (framing < 40 && tips.length < 2) {
    tips.push("Center yourself in the frame with some margin around your body.");
  }

  return { category, poseDirection, trackedRegions, tips: tips.slice(0, 2), scores };
}
