/**
 * Mock landmarks generator for testing when camera/model unavailable.
 * Activated via ?mock=1 query param.
 * Generates a gentle swaying motion for realism.
 */

import type { Landmark, WorldLandmark, PoseDetectionResult } from "../models/types";
import { LM } from "../models/types";
import { POSE_TEMPLATES } from "../models/poseTemplates";

export function generateMockLandmarks(
  poseId: string,
  frameCount: number
): PoseDetectionResult {
  const template = POSE_TEMPLATES.find((t) => t.id === poseId) ?? POSE_TEMPLATES[0];
  const landmarks: Landmark[] = new Array(33).fill(null).map(() => ({
    x: 0,
    y: 0,
    z: 0,
    visibility: 0,
  }));

  const worldLandmarks: WorldLandmark[] = new Array(33).fill(null).map(() => ({
    x: 0,
    y: 0,
    z: 0,
    visibility: 0,
  }));

  // Time-based sway for natural movement
  const t = frameCount * 0.02;
  const swayX = Math.sin(t) * 0.008;
  const swayY = Math.cos(t * 0.7) * 0.005;

  // 2D: center=hipMid, scale=bodyHeight as fraction of frame
  const centerX = 0.5;
  const centerY = 0.45;
  const scale = 0.7;

  // World: average body height in meters
  const worldScale = 1.75;
  const swayWorld = Math.sin(t) * 0.005;

  for (const [jointIdx, pos] of Object.entries(template.templateNormalized)) {
    const idx = Number(jointIdx);
    const p = pos as { x: number; y: number };
    if (idx >= 0 && idx < 33) {
      const vis = 0.95 + Math.random() * 0.05;
      landmarks[idx] = {
        x: centerX + p.x * scale + swayX,
        y: centerY + p.y * scale + swayY,
        z: 0,
        visibility: vis,
      };
      worldLandmarks[idx] = {
        x: p.x * worldScale + swayWorld,
        y: p.y * worldScale,
        z: -0.02 + Math.random() * 0.01,
        visibility: vis,
      };
    }
  }

  // Fill in missing nose
  if (!landmarks[LM.NOSE].visibility) {
    landmarks[LM.NOSE] = {
      x: centerX + swayX,
      y: centerY - 0.47 * scale + swayY,
      z: 0,
      visibility: 0.9,
    };
    worldLandmarks[LM.NOSE] = {
      x: swayWorld,
      y: -0.47 * worldScale,
      z: 0,
      visibility: 0.9,
    };
  }

  return { landmarks, worldLandmarks };
}
