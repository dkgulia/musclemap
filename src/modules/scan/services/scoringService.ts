/**
 * Scoring service: computes alignment score, confidence score, and measurements
 * from raw MediaPipe landmarks + a pose template.
 *
 * Supports partial body visibility — works with upper body, torso-only, etc.
 */

import type { Landmark, WorldLandmark, PoseTemplate, Measurements, ScoreBreakdown, Point2D, SymmetryData, SymmetryPair } from "../models/types";
import { LM, SYMMETRY_PAIRS } from "../models/types";
import { measureBrightness, brightnessScore } from "./brightnessService";

// ─── Helpers ────────────────────────────────────────────────────

function dist(a: Point2D, b: Point2D): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function mid(a: Point2D, b: Point2D): Point2D {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

const VIS = 0.2; // visibility threshold (lowered from 0.3 for more leniency)

function visible(lm: Landmark | undefined): lm is Landmark {
  return !!lm && lm.visibility > VIS;
}

function lmToPixel(lm: Landmark, w: number, h: number): Point2D {
  return { x: lm.x * w, y: lm.y * h };
}

// ─── 3D World Landmark Helpers ───────────────────────────────────

function dist3D(a: WorldLandmark, b: WorldLandmark): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
}

function visibleWorld(wl: WorldLandmark | undefined): wl is WorldLandmark {
  return !!wl && wl.visibility > VIS;
}

// ─── Body geometry helpers ──────────────────────────────────────

interface BodyGeometry {
  center: Point2D;
  scale: number; // estimated full body height in pixels
  quality: "full" | "upper" | "torso" | "head"; // how much of body is visible
}

/**
 * Estimate body center and scale from whatever landmarks are visible.
 * Uses a fallback chain so partial body still produces usable geometry.
 */
function estimateBodyGeometry(
  landmarks: Landmark[],
  videoW: number,
  videoH: number
): BodyGeometry | null {
  const nose = landmarks[LM.NOSE];
  const lShoulder = landmarks[LM.LEFT_SHOULDER];
  const rShoulder = landmarks[LM.RIGHT_SHOULDER];
  const lHip = landmarks[LM.LEFT_HIP];
  const rHip = landmarks[LM.RIGHT_HIP];
  const lAnkle = landmarks[LM.LEFT_ANKLE];
  const rAnkle = landmarks[LM.RIGHT_ANKLE];

  const hasNose = visible(nose);
  const hasShoulders = visible(lShoulder) && visible(rShoulder);
  const hasHips = visible(lHip) && visible(rHip);
  const hasAnkles = visible(lAnkle) && visible(rAnkle);

  // Need at least shoulders to compute anything useful
  if (!hasShoulders) return null;

  const lsPx = lmToPixel(lShoulder, videoW, videoH);
  const rsPx = lmToPixel(rShoulder, videoW, videoH);
  const shoulderMid = mid(lsPx, rsPx);

  // Center: prefer hip midpoint, fallback to shoulder midpoint
  let center: Point2D;
  let hipMid: Point2D | null = null;
  if (hasHips) {
    hipMid = mid(lmToPixel(lHip, videoW, videoH), lmToPixel(rHip, videoW, videoH));
    center = hipMid;
  } else {
    center = shoulderMid;
  }

  // Scale (estimated full body height): fallback chain
  // Anatomical ratios for estimation:
  // - nose-to-ankles ≈ full body height (best)
  // - nose-to-hips ≈ 48% of body height → multiply by 2.1
  // - shoulders-to-hips ≈ 31% of body height → multiply by 3.2
  // - nose-to-shoulders ≈ 18% of body height → multiply by 5.5

  let scale: number;
  let quality: BodyGeometry["quality"];

  if (hasAnkles) {
    const ankleMid = mid(lmToPixel(lAnkle, videoW, videoH), lmToPixel(rAnkle, videoW, videoH));
    if (hasNose) {
      scale = dist(lmToPixel(nose, videoW, videoH), ankleMid);
    } else {
      scale = dist(shoulderMid, ankleMid) * 1.2; // shoulders to ankles ≈ 83% of full
    }
    quality = "full";
  } else if (hasHips && hasNose) {
    scale = dist(lmToPixel(nose, videoW, videoH), hipMid!) * 2.1;
    quality = "upper";
  } else if (hasHips) {
    scale = dist(shoulderMid, hipMid!) * 3.2;
    quality = "torso";
  } else if (hasNose) {
    scale = dist(lmToPixel(nose, videoW, videoH), shoulderMid) * 5.5;
    quality = "head";
  } else {
    // Only shoulders visible — estimate from shoulder width
    // Shoulder width ≈ 25% of body height
    scale = dist(lsPx, rsPx) * 4.0;
    quality = "head";
  }

  if (scale < 10) return null;

  return { center, scale, quality };
}

// ─── World Measurements (3D, meters) ────────────────────────────

function computeWorldMeasurements(
  worldLandmarks: WorldLandmark[],
  userHeightCm: number | null
): { shoulderWidthM: number; hipWidthM: number; bodyHeightM: number;
     shoulderWidthCm: number; hipWidthCm: number; bodyHeightCm: number } | null {
  const lShoulder = worldLandmarks[LM.LEFT_SHOULDER];
  const rShoulder = worldLandmarks[LM.RIGHT_SHOULDER];
  if (!visibleWorld(lShoulder) || !visibleWorld(rShoulder)) return null;

  const shoulderWidthM = dist3D(lShoulder, rShoulder);

  let hipWidthM = 0;
  const lHip = worldLandmarks[LM.LEFT_HIP];
  const rHip = worldLandmarks[LM.RIGHT_HIP];
  if (visibleWorld(lHip) && visibleWorld(rHip)) {
    hipWidthM = dist3D(lHip, rHip);
  }

  // Estimate body height from world landmarks
  const nose = worldLandmarks[LM.NOSE];
  const lAnkle = worldLandmarks[LM.LEFT_ANKLE];
  const rAnkle = worldLandmarks[LM.RIGHT_ANKLE];

  let bodyHeightM = 0;
  if (visibleWorld(nose) && visibleWorld(lAnkle) && visibleWorld(rAnkle)) {
    const ankleMidY = (lAnkle.y + rAnkle.y) / 2;
    bodyHeightM = Math.abs(nose.y - ankleMidY);
  } else if (visibleWorld(nose) && visibleWorld(lHip) && visibleWorld(rHip)) {
    const hipMidY = (lHip.y + rHip.y) / 2;
    bodyHeightM = Math.abs(nose.y - hipMidY) * 2.1;
  } else {
    bodyHeightM = shoulderWidthM * 4.0;
  }

  // Calibration: user height → scale factor
  let calibrationFactor = 1.0;
  if (userHeightCm && bodyHeightM > 0.1) {
    calibrationFactor = (userHeightCm / 100) / bodyHeightM;
  }

  return {
    shoulderWidthM,
    hipWidthM,
    bodyHeightM,
    shoulderWidthCm: userHeightCm ? shoulderWidthM * calibrationFactor * 100 : 0,
    hipWidthCm: userHeightCm ? hipWidthM * calibrationFactor * 100 : 0,
    bodyHeightCm: userHeightCm ? bodyHeightM * calibrationFactor * 100 : 0,
  };
}

// ─── Symmetry Analysis ──────────────────────────────────────────

export function computeSymmetry(worldLandmarks: WorldLandmark[]): SymmetryData | null {
  if (!worldLandmarks || worldLandmarks.length < 33) return null;

  const pairs: SymmetryPair[] = [];

  for (const { left, right, label } of SYMMETRY_PAIRS) {
    const leftLm = worldLandmarks[left];
    const rightLm = worldLandmarks[right];
    if (!visibleWorld(leftLm) || !visibleWorld(rightLm)) continue;

    // Height difference: compare y-coordinates
    const avgY = (Math.abs(leftLm.y) + Math.abs(rightLm.y)) / 2;
    const heightDiffPct = avgY > 0.001
      ? (Math.abs(leftLm.y - rightLm.y) / avgY) * 100
      : 0;

    // Distance from center (x=0 is center in world coords)
    const leftDist = Math.abs(leftLm.x);
    const rightDist = Math.abs(rightLm.x);
    const avgDist = (leftDist + rightDist) / 2;
    const distanceDiffPct = avgDist > 0.001
      ? (Math.abs(leftDist - rightDist) / avgDist) * 100
      : 0;

    const overallDiffPct = Math.max(heightDiffPct, distanceDiffPct);

    let status: SymmetryPair["status"];
    if (overallDiffPct < 5) status = "balanced";
    else if (overallDiffPct < 15) status = "moderate";
    else status = "imbalanced";

    pairs.push({
      leftIndex: left,
      rightIndex: right,
      label,
      heightDiffPct: Math.round(heightDiffPct * 10) / 10,
      distanceDiffPct: Math.round(distanceDiffPct * 10) / 10,
      overallDiffPct: Math.round(overallDiffPct * 10) / 10,
      status,
    });
  }

  if (pairs.length === 0) return null;

  const overallScore = Math.round(
    100 - pairs.reduce((sum, p) => sum + Math.min(p.overallDiffPct, 30), 0) / pairs.length
  );

  return { pairs, overallScore: clamp(overallScore, 0, 100) };
}

// ─── Measurements ───────────────────────────────────────────────

export function computeMeasurements(
  landmarks: Landmark[],
  videoW: number,
  videoH: number,
  worldLandmarks?: WorldLandmark[],
  userHeightCm?: number | null
): Measurements | null {
  const lShoulder = landmarks[LM.LEFT_SHOULDER];
  const rShoulder = landmarks[LM.RIGHT_SHOULDER];

  if (!visible(lShoulder) || !visible(rShoulder)) return null;

  const geo = estimateBodyGeometry(landmarks, videoW, videoH);
  if (!geo) return null;

  const lsPx = lmToPixel(lShoulder, videoW, videoH);
  const rsPx = lmToPixel(rShoulder, videoW, videoH);
  const shoulderWidthPx = dist(lsPx, rsPx);

  const lHip = landmarks[LM.LEFT_HIP];
  const rHip = landmarks[LM.RIGHT_HIP];
  let hipWidthPx = 0;
  if (visible(lHip) && visible(rHip)) {
    hipWidthPx = dist(lmToPixel(lHip, videoW, videoH), lmToPixel(rHip, videoW, videoH));
  }

  const bodyHeightPx = geo.scale;
  // Pixel-based ratios as fallback
  let shoulderIndex = bodyHeightPx > 0 ? shoulderWidthPx / bodyHeightPx : 0;
  let hipIndex = bodyHeightPx > 0 ? hipWidthPx / bodyHeightPx : 0;
  let vTaperIndex = hipWidthPx > 0 ? shoulderWidthPx / hipWidthPx : 0;

  // Compute world-coordinate measurements if available
  let worldM = {
    shoulderWidthM: 0, hipWidthM: 0, bodyHeightM: 0,
    shoulderWidthCm: 0, hipWidthCm: 0, bodyHeightCm: 0,
  };
  if (worldLandmarks && worldLandmarks.length >= 33) {
    const wm = computeWorldMeasurements(worldLandmarks, userHeightCm ?? null);
    if (wm) worldM = wm;
  }

  // Override with world-based ratios when available (camera-independent)
  if (worldM.shoulderWidthM > 0 && worldM.bodyHeightM > 0.1) {
    shoulderIndex = worldM.shoulderWidthM / worldM.bodyHeightM;
  }
  if (worldM.hipWidthM > 0 && worldM.bodyHeightM > 0.1) {
    hipIndex = worldM.hipWidthM / worldM.bodyHeightM;
  }
  if (worldM.shoulderWidthM > 0 && worldM.hipWidthM > 0) {
    vTaperIndex = worldM.shoulderWidthM / worldM.hipWidthM;
  }

  return {
    shoulderWidthPx,
    hipWidthPx,
    bodyHeightPx,
    shoulderIndex,
    hipIndex,
    vTaperIndex,
    ...worldM,
  };
}

// ─── Alignment Score ────────────────────────────────────────────

/**
 * K = 250 (lowered from 350). Tuned so that:
 * - Good match with full body (error ~0.02) → score ~95
 * - Decent match with partial body (error ~0.08) → score ~80
 * - Casual standing (error ~0.12) → score ~70
 * - Poor match (error ~0.25+) → score ~38
 * - Partial body with some joints (error ~0.15) → score ~62
 * Lowered from 350 to be more forgiving with partial landmark sets.
 */
const ALIGNMENT_K = 120;

export function computeAlignment(
  landmarks: Landmark[],
  template: PoseTemplate,
  videoW: number,
  videoH: number
): number {
  const geo = estimateBodyGeometry(landmarks, videoW, videoH);
  if (!geo) return 0;

  const { center, scale } = geo;

  let totalError = 0;
  let totalWeight = 0;
  let matchedCount = 0;

  for (const jointIdx of template.requiredLandmarks) {
    const lm = landmarks[jointIdx];
    const tgt = template.templateNormalized[jointIdx];
    const w = Math.min(template.weights[jointIdx] ?? 1, 1.0);

    if (!visible(lm) || !tgt) continue;

    const px = lmToPixel(lm, videoW, videoH);
    const normalized: Point2D = {
      x: (px.x - center.x) / scale,
      y: (px.y - center.y) / scale,
    };

    const err = dist(normalized, tgt);
    totalError += err * w;
    totalWeight += w;
    matchedCount++;
  }

  // If fewer than 3 joints matched, return minimum score
  // (something is detected but not enough to compute alignment)
  if (matchedCount < 2) return matchedCount > 0 ? 10 : 0;
  if (totalWeight === 0) return 0;

  const avgError = totalError / totalWeight;
  return clamp(100 - avgError * ALIGNMENT_K, 0, 100);
}

// ─── Confidence Score ───────────────────────────────────────────

export function computeConfidence(
  landmarks: Landmark[],
  template: PoseTemplate,
  alignmentScore: number,
  video: HTMLVideoElement,
  videoW: number,
  videoH: number
): { total: number; breakdown: ScoreBreakdown } {
  // 1. Landmarks visible (max 30)
  let visibleCount = 0;
  for (const idx of template.requiredLandmarks) {
    if (visible(landmarks[idx])) {
      visibleCount++;
    }
  }
  const landmarksVisible = (visibleCount / template.requiredLandmarks.length) * 30;

  // 2. Brightness (max 20)
  const avgLuma = measureBrightness(video);
  const brightness = brightnessScore(avgLuma);

  // 3. Distance/scale (max 20)
  let distanceScore = 0;
  const measurements = computeMeasurements(landmarks, videoW, videoH);
  if (measurements && measurements.bodyHeightPx > 0) {
    const ratio = measurements.bodyHeightPx / videoH;
    if (ratio >= 0.40 && ratio <= 0.90) {
      distanceScore = 20;
    } else if (ratio < 0.40) {
      distanceScore = clamp((ratio / 0.40) * 20, 0, 20);
    } else {
      distanceScore = clamp(((1 - ratio) / 0.10) * 20, 0, 20);
    }
  } else if (measurements && measurements.shoulderWidthPx > 0) {
    // Fallback: use shoulder width relative to frame width
    // Ideal: shoulders take up 30-50% of frame width
    const ratio = measurements.shoulderWidthPx / videoW;
    if (ratio >= 0.15 && ratio <= 0.55) {
      distanceScore = 18;
    } else {
      distanceScore = clamp((ratio / 0.35) * 18, 0, 18);
    }
  }

  // 4. Pose match (max 30)
  const poseMatch = (alignmentScore / 100) * 30;

  const breakdown: ScoreBreakdown = {
    landmarksVisible: Math.round(landmarksVisible * 10) / 10,
    brightness: Math.round(brightness * 10) / 10,
    distance: Math.round(distanceScore * 10) / 10,
    poseMatch: Math.round(poseMatch * 10) / 10,
  };

  const total = clamp(
    landmarksVisible + brightness + distanceScore + poseMatch,
    0,
    100
  );

  return { total, breakdown };
}

// ─── Tip generation ────────────────────────────────────────────

export function generateTip(breakdown: ScoreBreakdown): string {
  const ratios = [
    { ratio: breakdown.brightness / 20, tip: "Improve lighting — move to a brighter area" },
    { ratio: breakdown.distance / 20, tip: "Step back — show your full body in frame" },
    { ratio: breakdown.landmarksVisible / 30, tip: "Show your full body — some joints aren't visible" },
    { ratio: breakdown.poseMatch / 30, tip: "Align to the outline — match the pose template" },
  ];

  ratios.sort((a, b) => a.ratio - b.ratio);
  return ratios[0].tip;
}

// ─── Body visibility check ─────────────────────────────────────

export function getBodyVisibility(landmarks: Landmark[]): "full" | "upper" | "partial" | "none" {
  const hasShoulders = visible(landmarks[LM.LEFT_SHOULDER]) && visible(landmarks[LM.RIGHT_SHOULDER]);
  const hasHips = visible(landmarks[LM.LEFT_HIP]) && visible(landmarks[LM.RIGHT_HIP]);
  const hasAnkles = visible(landmarks[LM.LEFT_ANKLE]) && visible(landmarks[LM.RIGHT_ANKLE]);

  if (!hasShoulders) return "none";
  if (hasAnkles) return "full";
  if (hasHips) return "upper";
  return "partial";
}

// ─── EMA Smoothing ──────────────────────────────────────────────

export function ema(prev: number, curr: number, alpha: number = 0.12): number {
  return prev * (1 - alpha) + curr * alpha;
}
