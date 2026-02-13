/**
 * Pose detection service using MediaPipe Tasks Vision PoseLandmarker.
 * Runs in the browser with WASM + GPU delegate.
 */

import {
  PoseLandmarker,
  FilesetResolver,
  type PoseLandmarkerResult,
} from "@mediapipe/tasks-vision";
import type { Landmark, WorldLandmark, PoseDetectionResult } from "../models/types";

let landmarker: PoseLandmarker | null = null;
let initPromise: Promise<PoseLandmarker> | null = null;

const WASM_CDN =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

export async function initPose(): Promise<PoseLandmarker> {
  if (landmarker) return landmarker;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const vision = await FilesetResolver.forVisionTasks(WASM_CDN);
    const lm = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: MODEL_URL,
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numPoses: 1,
    });
    landmarker = lm;
    return lm;
  })();

  return initPromise;
}

export function detectPose(
  video: HTMLVideoElement,
  timestampMs: number
): PoseDetectionResult | null {
  if (!landmarker) return null;

  let result: PoseLandmarkerResult;
  try {
    result = landmarker.detectForVideo(video, timestampMs);
  } catch {
    return null;
  }

  if (!result.landmarks || result.landmarks.length === 0) return null;

  const rawNorm = result.landmarks[0];
  const landmarks: Landmark[] = rawNorm.map((lm) => ({
    x: lm.x,
    y: lm.y,
    z: lm.z,
    visibility: lm.visibility ?? 0,
  }));

  // Extract 3D world landmarks (meters, hip-centered)
  let worldLandmarks: WorldLandmark[] = [];
  if (result.worldLandmarks && result.worldLandmarks.length > 0) {
    const rawWorld = result.worldLandmarks[0];
    worldLandmarks = rawWorld.map((wl) => ({
      x: wl.x,
      y: wl.y,
      z: wl.z,
      visibility: wl.visibility ?? 0,
    }));
  }

  return { landmarks, worldLandmarks };
}

export function destroyPose() {
  if (landmarker) {
    landmarker.close();
    landmarker = null;
    initPromise = null;
  }
}
