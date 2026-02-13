/**
 * One-Photo Analyze orchestrator.
 * Takes a photo file, runs pose detection + segmentation, computes
 * body slice widths, confidence, and consistency.
 */

import type {
  Landmark,
  WorldLandmark,
  Measurements,
  SymmetryData,
  SliceIndices,
  PhotoConfidenceBreakdown,
  ConsistencyDetails,
} from "../models/types";
import { LM } from "../models/types";
import { getTemplate } from "../models/poseTemplates";
import {
  initPoseForImage,
  detectPoseOnImage,
  type ImagePoseResult,
} from "./poseService";
import {
  computeAlignment,
  computeMeasurements,
  computeSymmetry,
  getBodyVisibility,
} from "./scoringService";
import {
  measureBrightnessFromCanvas,
  brightnessScore,
} from "./brightnessService";
import {
  binarizeMask,
  maskQualityScore,
  computeBodySliceIndices,
  type MaskData,
} from "./segmentationService";
import { listScans } from "../storage/scanStore";

// ─── Public types ───────────────────────────────────────────────

export interface PhotoScanOptions {
  mirrored?: boolean; // default false for uploaded photos
}

export interface PhotoScanResult {
  landmarks: Landmark[];
  worldLandmarks: WorldLandmark[];
  bodyVisibility: "full" | "upper" | "partial" | "none";

  measurements: Measurements;
  symmetryData: SymmetryData | null;
  alignmentScore: number;

  sliceIndices: SliceIndices | null;

  confidenceScore: number;
  confidenceBreakdown: PhotoConfidenceBreakdown;
  segmentationQuality: number;
  consistencyScore: number;
  consistencyPasses: boolean;
  consistencyDetails: ConsistencyDetails;
  avgBrightness: number;

  normalizedCanvas: HTMLCanvasElement;

  binaryMask: Uint8Array | null;
  maskWidth: number;
  maskHeight: number;
  sliceYPositions: {
    hipY: number;
    upperThighY: number;
    midThighY: number;
    calfY: number;
  } | null;

  warnings: string[];
}

// ─── Helpers ────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Draw image to canvas, optionally mirrored horizontally */
async function imageToCanvas(
  file: File | Blob,
  mirrored: boolean
): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d")!;

  if (mirrored) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }

  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas;
}

/** Compute shoulder/hip tilt angle in degrees */
function computeTiltDeg(
  landmarks: Landmark[],
  leftIdx: number,
  rightIdx: number,
  imageWidth: number,
  imageHeight: number
): number {
  const lm1 = landmarks[leftIdx];
  const lm2 = landmarks[rightIdx];
  if (
    !lm1 || lm1.visibility < 0.2 ||
    !lm2 || lm2.visibility < 0.2
  )
    return 0;

  const dx = (lm2.x - lm1.x) * imageWidth;
  const dy = (lm2.y - lm1.y) * imageHeight;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

/** Compute stance width in pixels (distance between ankles) */
function computeStanceWidthPx(
  landmarks: Landmark[],
  imageWidth: number,
  imageHeight: number
): number {
  const lAnkle = landmarks[LM.LEFT_ANKLE];
  const rAnkle = landmarks[LM.RIGHT_ANKLE];
  if (
    !lAnkle || lAnkle.visibility < 0.2 ||
    !rAnkle || rAnkle.visibility < 0.2
  )
    return 0;

  const dx = (lAnkle.x - rAnkle.x) * imageWidth;
  const dy = (lAnkle.y - rAnkle.y) * imageHeight;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Compute slice Y positions for debug overlay */
function computeSliceYPositions(
  landmarks: Landmark[],
  imageHeight: number
): { hipY: number; upperThighY: number; midThighY: number; calfY: number } | null {
  const lHip = landmarks[LM.LEFT_HIP];
  const rHip = landmarks[LM.RIGHT_HIP];
  const lKnee = landmarks[LM.LEFT_KNEE];
  const rKnee = landmarks[LM.RIGHT_KNEE];
  const lAnkle = landmarks[LM.LEFT_ANKLE];
  const rAnkle = landmarks[LM.RIGHT_ANKLE];

  const vis = 0.2;
  if (
    !lHip || lHip.visibility < vis ||
    !rHip || rHip.visibility < vis ||
    !lKnee || lKnee.visibility < vis ||
    !rKnee || rKnee.visibility < vis ||
    !lAnkle || lAnkle.visibility < vis ||
    !rAnkle || rAnkle.visibility < vis
  ) return null;

  const yHip = ((lHip.y + rHip.y) / 2) * imageHeight;
  const yKnee = ((lKnee.y + rKnee.y) / 2) * imageHeight;
  const yAnkle = ((lAnkle.y + rAnkle.y) / 2) * imageHeight;

  return {
    hipY: yHip,
    upperThighY: yHip + 0.20 * (yKnee - yHip),
    midThighY: yHip + 0.55 * (yKnee - yHip),
    calfY: yKnee + 0.55 * (yAnkle - yKnee),
  };
}

// ─── Confidence ─────────────────────────────────────────────────

function computePhotoConfidence(
  landmarks: Landmark[],
  requiredLandmarks: number[],
  alignmentScore: number,
  avgBrightness: number,
  bodyHeightPx: number,
  imageHeight: number,
  segQuality: number
): { total: number; breakdown: PhotoConfidenceBreakdown } {
  // 1. Landmarks visible (max 30)
  let visibleCount = 0;
  for (const idx of requiredLandmarks) {
    if (landmarks[idx] && landmarks[idx].visibility > 0.2) visibleCount++;
  }
  const landmarksVisible = (visibleCount / requiredLandmarks.length) * 30;

  // 2. Brightness (max 20)
  const brightness = brightnessScore(avgBrightness);

  // 3. Distance/scale (max 20)
  let distance = 0;
  if (bodyHeightPx > 0) {
    const ratio = bodyHeightPx / imageHeight;
    if (ratio >= 0.40 && ratio <= 0.90) {
      distance = 20;
    } else if (ratio < 0.40) {
      distance = clamp((ratio / 0.40) * 20, 0, 20);
    } else {
      distance = clamp(((1 - ratio) / 0.10) * 20, 0, 20);
    }
  }

  // 4. Pose match (max 20 — reduced from 30 to make room for segmentation)
  const poseMatch = (alignmentScore / 100) * 20;

  // 5. Segmentation quality (max 10)
  const segmentationQuality = (segQuality / 100) * 10;

  const breakdown: PhotoConfidenceBreakdown = {
    landmarksVisible: Math.round(landmarksVisible * 10) / 10,
    brightness: Math.round(brightness * 10) / 10,
    distance: Math.round(distance * 10) / 10,
    poseMatch: Math.round(poseMatch * 10) / 10,
    segmentationQuality: Math.round(segmentationQuality * 10) / 10,
  };

  const total = clamp(
    landmarksVisible + brightness + distance + poseMatch + segmentationQuality,
    0,
    100
  );

  return { total, breakdown };
}

// ─── Consistency ────────────────────────────────────────────────

async function computeConsistency(
  poseType: string,
  bodyHeightPx: number,
  stanceWidthPx: number,
  hipTiltDeg: number
): Promise<{ score: number; passes: boolean; details: ConsistencyDetails }> {
  const defaults: ConsistencyDetails = {
    scaleMatch: true,
    stanceMatch: true,
    hipTiltMatch: true,
    brightnessMatch: true,
  };

  // Get most recent scan of same poseType
  let prevScans;
  try {
    prevScans = await listScans(poseType, 1);
  } catch {
    return { score: 100, passes: true, details: defaults };
  }

  if (prevScans.length === 0) {
    // No previous scan — auto-pass
    return { score: 100, passes: true, details: defaults };
  }

  const prev = prevScans[0];
  let matchCount = 0;
  const details = { ...defaults };

  // Scale: bodyHeightPx within ±7%
  if (prev.bodyHeightPx > 0 && bodyHeightPx > 0) {
    const diff = Math.abs(bodyHeightPx - prev.bodyHeightPx) / prev.bodyHeightPx;
    details.scaleMatch = diff <= 0.07;
    if (details.scaleMatch) matchCount++;
  } else {
    matchCount++;
  }

  // Stance width within ±8%
  const prevStance = prev.stanceWidthIndex ?? 0;
  if (prevStance > 0 && stanceWidthPx > 0) {
    const currStanceIdx = prev.bodyHeightPx > 0 ? stanceWidthPx / prev.bodyHeightPx : 0;
    const diff = Math.abs(currStanceIdx - prevStance) / prevStance;
    details.stanceMatch = diff <= 0.08;
    if (details.stanceMatch) matchCount++;
  } else {
    matchCount++;
  }

  // Hip tilt within ±6°
  const prevTilt = prev.hipTiltDeg ?? 0;
  details.hipTiltMatch = Math.abs(hipTiltDeg - prevTilt) <= 6;
  if (details.hipTiltMatch) matchCount++;

  // Brightness within ±25 luma (approximate; we don't store luma in old records)
  // For now, always pass brightness
  details.brightnessMatch = true;
  matchCount++;

  const score = (matchCount / 4) * 100;

  return { score, passes: score >= 65, details };
}

// ─── Main Entry Point ───────────────────────────────────────────

export async function analyzePhoto(
  file: File | Blob,
  poseType: string,
  options?: PhotoScanOptions
): Promise<PhotoScanResult> {
  const mirrored = options?.mirrored ?? false;
  const warnings: string[] = [];

  // 1. Decode + canvas
  const canvas = await imageToCanvas(file, mirrored);
  const w = canvas.width;
  const h = canvas.height;

  // 2. Init + detect
  await initPoseForImage();
  const poseResult: ImagePoseResult | null = detectPoseOnImage(canvas);

  if (!poseResult) {
    throw new Error("No person detected in this photo. Try a clearer full-body photo.");
  }

  const { landmarks, worldLandmarks, segmentationMask, maskWidth, maskHeight } = poseResult;

  // 3. Body visibility
  const bodyVisibility = getBodyVisibility(landmarks);
  if (bodyVisibility === "none" || bodyVisibility === "partial") {
    warnings.push("Full body not visible — show your entire body for best results");
  }

  // 4. Alignment
  const template = getTemplate(poseType);
  const alignmentScore = template ? computeAlignment(landmarks, template, w, h) : 0;

  // 5. Measurements
  const measurements = computeMeasurements(landmarks, w, h, worldLandmarks);
  if (!measurements) {
    throw new Error("Could not compute body measurements. Ensure shoulders are visible.");
  }

  // 6. Symmetry
  const symmetryData = computeSymmetry(worldLandmarks);

  // 7. Brightness
  const avgBrightness = measureBrightnessFromCanvas(canvas);
  if (avgBrightness < 40) {
    warnings.push("Photo is too dark — use better lighting for accurate analysis");
  } else if (avgBrightness > 230) {
    warnings.push("Photo is overexposed — reduce brightness for better results");
  }

  // 8. Tilt angles
  computeTiltDeg(landmarks, LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, w, h);
  const hipTiltDeg = computeTiltDeg(landmarks, LM.LEFT_HIP, LM.RIGHT_HIP, w, h);

  // 9. Segmentation mask processing
  let binaryMask: Uint8Array | null = null;
  let segQuality = 0;
  let sliceIndices: SliceIndices | null = null;

  if (segmentationMask.length > 0) {
    const maskData: MaskData = { mask: segmentationMask, width: maskWidth, height: maskHeight };
    binaryMask = binarizeMask(maskData);
    segQuality = maskQualityScore(maskData);

    // 10. Slice indices (only if full body visible)
    if (bodyVisibility === "full") {
      sliceIndices = computeBodySliceIndices(
        binaryMask,
        maskWidth,
        landmarks,
        w,
        h,
        measurements.bodyHeightPx
      );
      if (!sliceIndices) {
        warnings.push("Could not compute lower body widths — ensure legs are fully visible");
      }
    }
  } else {
    warnings.push("Segmentation not available — body shape analysis limited");
  }

  // 11. Confidence
  const requiredLandmarks = template?.requiredLandmarks ?? [
    LM.NOSE, LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER,
    LM.LEFT_HIP, LM.RIGHT_HIP, LM.LEFT_KNEE, LM.RIGHT_KNEE,
    LM.LEFT_ANKLE, LM.RIGHT_ANKLE,
  ];
  const { total: confidenceScore, breakdown: confidenceBreakdown } =
    computePhotoConfidence(
      landmarks,
      requiredLandmarks,
      alignmentScore,
      avgBrightness,
      measurements.bodyHeightPx,
      h,
      segQuality
    );

  // 12. Stance width
  const stanceWidthPx = computeStanceWidthPx(landmarks, w, h);

  // 13. Consistency
  const { score: consistencyScore, passes: consistencyPasses, details: consistencyDetails } =
    await computeConsistency(poseType, measurements.bodyHeightPx, stanceWidthPx, hipTiltDeg);

  if (!consistencyPasses && consistencyScore < 100) {
    const tips: string[] = [];
    if (!consistencyDetails.scaleMatch) tips.push("distance from camera");
    if (!consistencyDetails.stanceMatch) tips.push("foot placement");
    if (!consistencyDetails.hipTiltMatch) tips.push("hip alignment");
    if (tips.length > 0) {
      warnings.push(`Inconsistent with previous scan: adjust ${tips.join(", ")}`);
    }
  }

  // 14. Slice Y positions (for debug overlay)
  const sliceYPositions = computeSliceYPositions(landmarks, h);

  return {
    landmarks,
    worldLandmarks,
    bodyVisibility,
    measurements,
    symmetryData,
    alignmentScore,
    sliceIndices,
    confidenceScore,
    confidenceBreakdown,
    segmentationQuality: segQuality,
    consistencyScore,
    consistencyPasses,
    consistencyDetails,
    avgBrightness,
    normalizedCanvas: canvas,
    binaryMask,
    maskWidth,
    maskHeight,
    sliceYPositions,
    warnings,
  };
}
