/**
 * Segmentation mask processing — pure functions for mask analysis.
 * No model loading here; masks come from PoseLandmarker's segmentation output.
 */

import type { Landmark, SliceIndices } from "../models/types";
import { LM } from "../models/types";

// ─── Types ──────────────────────────────────────────────────────

export interface MaskData {
  mask: Float32Array; // 0..1 confidence per pixel (row-major)
  width: number;
  height: number;
}

export interface SliceWidthResult {
  totalWidthPx: number;
  leftWidthPx: number; // pixels from center to left edge
  rightWidthPx: number; // pixels from center to right edge
  centerX: number; // detected center at this row
}

// ─── Binarize ───────────────────────────────────────────────────

/**
 * Convert confidence mask to binary (0/1) mask.
 * Default threshold 0.5.
 */
export function binarizeMask(
  data: MaskData,
  threshold: number = 0.5
): Uint8Array {
  const out = new Uint8Array(data.mask.length);
  for (let i = 0; i < data.mask.length; i++) {
    out[i] = data.mask[i] >= threshold ? 1 : 0;
  }
  return out;
}

// ─── Mask Quality ───────────────────────────────────────────────

/**
 * Score 0-100 based on:
 * - mask area ratio (15-60% of image is ideal)
 * - edge noise (fewer isolated pixels = better)
 */
export function maskQualityScore(data: MaskData): number {
  const totalPixels = data.width * data.height;
  if (totalPixels === 0) return 0;

  // Count mask pixels above threshold
  let maskPixels = 0;
  for (let i = 0; i < data.mask.length; i++) {
    if (data.mask[i] >= 0.5) maskPixels++;
  }

  const areaRatio = maskPixels / totalPixels;

  // Area ratio score (0-60): ideal 15-60%
  let areaScore: number;
  if (areaRatio >= 0.15 && areaRatio <= 0.60) {
    areaScore = 60;
  } else if (areaRatio < 0.05) {
    areaScore = 0;
  } else if (areaRatio < 0.15) {
    areaScore = ((areaRatio - 0.05) / 0.10) * 60;
  } else {
    // > 0.60
    areaScore = Math.max(0, 60 - ((areaRatio - 0.60) / 0.20) * 60);
  }

  // Edge coherence score (0-40): sample rows, check for single contiguous region
  const binaryMask = binarizeMask(data);
  let coherentRows = 0;
  const sampleStep = Math.max(1, Math.floor(data.height / 20));
  let sampledRows = 0;

  for (let y = 0; y < data.height; y += sampleStep) {
    sampledRows++;
    const rowStart = y * data.width;
    let transitions = 0;
    for (let x = 1; x < data.width; x++) {
      if (binaryMask[rowStart + x] !== binaryMask[rowStart + x - 1]) {
        transitions++;
      }
    }
    // A clean row has exactly 2 transitions (background→person→background)
    // or 0 transitions (all background or all person)
    if (transitions <= 2) coherentRows++;
  }

  const coherenceScore =
    sampledRows > 0 ? (coherentRows / sampledRows) * 40 : 0;

  return Math.round(Math.min(100, areaScore + coherenceScore));
}

// ─── Slice Width ────────────────────────────────────────────────

/**
 * Compute silhouette width at a given Y coordinate.
 * Samples row y ± sampleRadius and takes median of total widths.
 */
export function computeSliceWidth(
  binaryMask: Uint8Array,
  width: number,
  y: number,
  sampleRadius: number = 3
): SliceWidthResult | null {
  const height = binaryMask.length / width;
  const widths: number[] = [];
  const centers: number[] = [];

  for (let dy = -sampleRadius; dy <= sampleRadius; dy++) {
    const row = Math.round(y + dy);
    if (row < 0 || row >= height) continue;

    const rowStart = row * width;
    let leftEdge = -1;
    let rightEdge = -1;

    // Scan left to right for first mask pixel
    for (let x = 0; x < width; x++) {
      if (binaryMask[rowStart + x] === 1) {
        leftEdge = x;
        break;
      }
    }
    // Scan right to left for last mask pixel
    for (let x = width - 1; x >= 0; x--) {
      if (binaryMask[rowStart + x] === 1) {
        rightEdge = x;
        break;
      }
    }

    if (leftEdge >= 0 && rightEdge > leftEdge) {
      widths.push(rightEdge - leftEdge + 1);
      centers.push((leftEdge + rightEdge) / 2);
    }
  }

  if (widths.length === 0) return null;

  // Take median
  const sortedWidths = [...widths].sort((a, b) => a - b);
  const sortedCenters = [...centers].sort((a, b) => a - b);
  const medianWidth = sortedWidths[Math.floor(sortedWidths.length / 2)];
  const medianCenter = sortedCenters[Math.floor(sortedCenters.length / 2)];

  // Use median center to split L/R
  // Find actual edges at the row closest to median
  const bestRow = Math.round(y);
  const rowStart = bestRow * width;
  let leftEdge = -1;
  let rightEdge = -1;
  for (let x = 0; x < width; x++) {
    if (binaryMask[rowStart + x] === 1) {
      leftEdge = x;
      break;
    }
  }
  for (let x = width - 1; x >= 0; x--) {
    if (binaryMask[rowStart + x] === 1) {
      rightEdge = x;
      break;
    }
  }

  const center = leftEdge >= 0 && rightEdge >= 0 ? (leftEdge + rightEdge) / 2 : medianCenter;

  return {
    totalWidthPx: medianWidth,
    leftWidthPx: Math.round(center - (leftEdge >= 0 ? leftEdge : center - medianWidth / 2)),
    rightWidthPx: Math.round((rightEdge >= 0 ? rightEdge : center + medianWidth / 2) - center),
    centerX: Math.round(center),
  };
}

// ─── Body Slice Indices ─────────────────────────────────────────

/**
 * Compute width indices at hip, upper thigh, mid thigh, calf.
 * Landmarks are in normalized 0..1 coordinates; we convert to mask pixel space.
 */
export function computeBodySliceIndices(
  binaryMask: Uint8Array,
  maskWidth: number,
  landmarks: Landmark[],
  imageWidth: number,
  imageHeight: number,
  bodyHeightPx: number
): SliceIndices | null {
  if (bodyHeightPx <= 0) return null;

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
  ) {
    return null;
  }

  // Convert landmarks to mask pixel coordinates
  // Mask may be different resolution than image, scale accordingly
  const scaleY = (binaryMask.length / maskWidth) / imageHeight;

  const yHip = ((lHip.y + rHip.y) / 2) * imageHeight * scaleY;
  const yKnee = ((lKnee.y + rKnee.y) / 2) * imageHeight * scaleY;
  const yAnkle = ((lAnkle.y + rAnkle.y) / 2) * imageHeight * scaleY;

  // Slice Y positions
  const hipBandY = yHip;
  const upperThighY = yHip + 0.20 * (yKnee - yHip);
  const midThighY = yHip + 0.55 * (yKnee - yHip);
  const calfY = yKnee + 0.55 * (yAnkle - yKnee);

  // Scale bodyHeightPx to mask space
  const bodyHeightInMask = bodyHeightPx * scaleY;

  const hipSlice = computeSliceWidth(binaryMask, maskWidth, hipBandY);
  const upperThighSlice = computeSliceWidth(binaryMask, maskWidth, upperThighY);
  const midThighSlice = computeSliceWidth(binaryMask, maskWidth, midThighY);
  const calfSlice = computeSliceWidth(binaryMask, maskWidth, calfY);

  if (!hipSlice || !upperThighSlice || !midThighSlice || !calfSlice) {
    return null;
  }

  return {
    hipBandWidthIndex: hipSlice.totalWidthPx / bodyHeightInMask,
    upperThighWidthIndex: upperThighSlice.totalWidthPx / bodyHeightInMask,
    midThighWidthIndex: midThighSlice.totalWidthPx / bodyHeightInMask,
    calfWidthIndex: calfSlice.totalWidthPx / bodyHeightInMask,
    hipBandLeftPx: hipSlice.leftWidthPx,
    hipBandRightPx: hipSlice.rightWidthPx,
    upperThighLeftPx: upperThighSlice.leftWidthPx,
    upperThighRightPx: upperThighSlice.rightWidthPx,
    midThighLeftPx: midThighSlice.leftWidthPx,
    midThighRightPx: midThighSlice.rightWidthPx,
    calfLeftPx: calfSlice.leftWidthPx,
    calfRightPx: calfSlice.rightWidthPx,
  };
}
