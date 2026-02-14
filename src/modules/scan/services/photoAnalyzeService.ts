/**
 * Unified photo analysis pipeline.
 * Works for both uploaded files and live-captured frames.
 * decode → pose detect → brightness → classify → return PhotoAnalysis
 */

import type { PhotoAnalysis } from "../models/types";
import { initPoseForImage, detectPoseOnImage } from "./poseService";
import { measureBrightnessFromCanvas } from "./brightnessService";
import {
  computeAlignment,
  computeMeasurements,
  computeSymmetry,
} from "./scoringService";
import { getTemplate } from "../models/poseTemplates";
import { classifyPhoto } from "./photoClassifierService";

// ─── Helpers ────────────────────────────────────────────────────

const MAX_CANVAS_WIDTH = 720;

async function fileToCanvas(file: File | Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  const scale = bitmap.width > MAX_CANVAS_WIDTH ? MAX_CANVAS_WIDTH / bitmap.width : 1;
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return canvas;
}

function videoToCanvas(video: HTMLVideoElement, mirror: boolean): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d")!;

  if (mirror) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, 0, 0);
  return canvas;
}

// ─── Core pipeline ──────────────────────────────────────────────

async function analyzeCanvas(
  canvas: HTMLCanvasElement,
  templateId: string,
  userHeightCm: number | null
): Promise<PhotoAnalysis> {
  const w = canvas.width;
  const h = canvas.height;

  // 1. Pose detection
  await initPoseForImage();
  const poseResult = detectPoseOnImage(canvas);

  if (!poseResult) {
    throw new Error("No person detected. Try a clearer photo with good lighting.");
  }

  const { landmarks, worldLandmarks } = poseResult;

  // 2. Brightness
  const avgBrightness = measureBrightnessFromCanvas(canvas);

  // 3. Alignment (best-match template)
  const template = getTemplate(templateId);
  const alignmentScore = template ? computeAlignment(landmarks, template, w, h) : 0;

  // 4. Classify
  const classification = classifyPhoto(landmarks, w, h, avgBrightness, alignmentScore);

  // 5. Measurements (may return null if shoulders not visible)
  const measurements = computeMeasurements(landmarks, w, h, worldLandmarks, userHeightCm);

  // 6. Symmetry
  const symmetryData = computeSymmetry(worldLandmarks);

  return {
    landmarks,
    worldLandmarks,
    canvas,
    classification,
    measurements,
    symmetryData,
    avgBrightness,
  };
}

// ─── Public API ─────────────────────────────────────────────────

/** Analyze an uploaded photo file */
export async function analyzeUploadedPhoto(
  file: File | Blob,
  templateId: string,
  userHeightCm: number | null
): Promise<PhotoAnalysis> {
  const canvas = await fileToCanvas(file);
  return analyzeCanvas(canvas, templateId, userHeightCm);
}

/** Analyze a live camera frame */
export async function analyzeLiveFrame(
  video: HTMLVideoElement,
  templateId: string,
  userHeightCm: number | null,
  mirror: boolean = true
): Promise<PhotoAnalysis> {
  const canvas = videoToCanvas(video, mirror);
  return analyzeCanvas(canvas, templateId, userHeightCm);
}
