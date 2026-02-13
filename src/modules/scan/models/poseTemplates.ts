import { LM, type PoseTemplate } from "./types";

/**
 * Template normalized coordinates:
 * - Origin = midpoint(leftHip, rightHip)
 * - Scale = bodyHeightPx = dist(nose, midpoint(leftAnkle, rightAnkle))
 * - Y is negative above hips, positive below
 * - X is negative to subject's right (viewer's left), positive to subject's left
 *
 * These are approximate target positions for each pose.
 * Tuned for a typical male physique standing ~6ft from camera.
 */

const allBodyLandmarks = [
  LM.NOSE,
  LM.LEFT_SHOULDER,
  LM.RIGHT_SHOULDER,
  LM.LEFT_ELBOW,
  LM.RIGHT_ELBOW,
  LM.LEFT_WRIST,
  LM.RIGHT_WRIST,
  LM.LEFT_HIP,
  LM.RIGHT_HIP,
  LM.LEFT_KNEE,
  LM.RIGHT_KNEE,
  LM.LEFT_ANKLE,
  LM.RIGHT_ANKLE,
];

const defaultWeights: Record<number, number> = {
  [LM.NOSE]: 0.5,
  [LM.LEFT_SHOULDER]: 1.0,
  [LM.RIGHT_SHOULDER]: 1.0,
  [LM.LEFT_ELBOW]: 1.2,
  [LM.RIGHT_ELBOW]: 1.2,
  [LM.LEFT_WRIST]: 1.0,
  [LM.RIGHT_WRIST]: 1.0,
  [LM.LEFT_HIP]: 0.8,
  [LM.RIGHT_HIP]: 0.8,
  [LM.LEFT_KNEE]: 0.5,
  [LM.RIGHT_KNEE]: 0.5,
  [LM.LEFT_ANKLE]: 0.3,
  [LM.RIGHT_ANKLE]: 0.3,
};

export const POSE_TEMPLATES: PoseTemplate[] = [
  {
    id: "front-biceps",
    name: "Front Biceps",
    ghostAssetPath: "/poses/front-biceps.svg",
    requiredLandmarks: allBodyLandmarks,
    weights: { ...defaultWeights, [LM.LEFT_ELBOW]: 1.5, [LM.RIGHT_ELBOW]: 1.5, [LM.LEFT_WRIST]: 1.3, [LM.RIGHT_WRIST]: 1.3 },
    templateNormalized: {
      [LM.NOSE]: { x: 0, y: -0.47 },
      [LM.LEFT_SHOULDER]: { x: -0.13, y: -0.33 },
      [LM.RIGHT_SHOULDER]: { x: 0.13, y: -0.33 },
      [LM.LEFT_ELBOW]: { x: -0.25, y: -0.33 },
      [LM.RIGHT_ELBOW]: { x: 0.25, y: -0.33 },
      [LM.LEFT_WRIST]: { x: -0.22, y: -0.46 },
      [LM.RIGHT_WRIST]: { x: 0.22, y: -0.46 },
      [LM.LEFT_HIP]: { x: -0.08, y: 0.0 },
      [LM.RIGHT_HIP]: { x: 0.08, y: 0.0 },
      [LM.LEFT_KNEE]: { x: -0.09, y: 0.22 },
      [LM.RIGHT_KNEE]: { x: 0.09, y: 0.22 },
      [LM.LEFT_ANKLE]: { x: -0.09, y: 0.45 },
      [LM.RIGHT_ANKLE]: { x: 0.09, y: 0.45 },
    },
  },
  {
    id: "back-lats",
    name: "Back Lats",
    ghostAssetPath: "/poses/back-lats.svg",
    requiredLandmarks: allBodyLandmarks,
    weights: { ...defaultWeights, [LM.LEFT_SHOULDER]: 1.5, [LM.RIGHT_SHOULDER]: 1.5 },
    templateNormalized: {
      [LM.NOSE]: { x: 0, y: -0.47 },
      [LM.LEFT_SHOULDER]: { x: -0.15, y: -0.33 },
      [LM.RIGHT_SHOULDER]: { x: 0.15, y: -0.33 },
      [LM.LEFT_ELBOW]: { x: -0.26, y: -0.22 },
      [LM.RIGHT_ELBOW]: { x: 0.26, y: -0.22 },
      [LM.LEFT_WRIST]: { x: -0.20, y: -0.10 },
      [LM.RIGHT_WRIST]: { x: 0.20, y: -0.10 },
      [LM.LEFT_HIP]: { x: -0.08, y: 0.0 },
      [LM.RIGHT_HIP]: { x: 0.08, y: 0.0 },
      [LM.LEFT_KNEE]: { x: -0.09, y: 0.22 },
      [LM.RIGHT_KNEE]: { x: 0.09, y: 0.22 },
      [LM.LEFT_ANKLE]: { x: -0.10, y: 0.45 },
      [LM.RIGHT_ANKLE]: { x: 0.10, y: 0.45 },
    },
  },
  {
    id: "side-glute",
    name: "Side Glute",
    ghostAssetPath: "/poses/side-glute.svg",
    requiredLandmarks: allBodyLandmarks,
    weights: { ...defaultWeights, [LM.LEFT_HIP]: 1.3, [LM.RIGHT_HIP]: 1.3, [LM.LEFT_KNEE]: 0.8, [LM.RIGHT_KNEE]: 0.8 },
    templateNormalized: {
      [LM.NOSE]: { x: 0.02, y: -0.47 },
      [LM.LEFT_SHOULDER]: { x: -0.04, y: -0.33 },
      [LM.RIGHT_SHOULDER]: { x: 0.06, y: -0.34 },
      [LM.LEFT_ELBOW]: { x: -0.06, y: -0.18 },
      [LM.RIGHT_ELBOW]: { x: 0.10, y: -0.20 },
      [LM.LEFT_WRIST]: { x: -0.02, y: -0.08 },
      [LM.RIGHT_WRIST]: { x: 0.06, y: -0.06 },
      [LM.LEFT_HIP]: { x: -0.03, y: 0.0 },
      [LM.RIGHT_HIP]: { x: 0.05, y: 0.0 },
      [LM.LEFT_KNEE]: { x: -0.04, y: 0.22 },
      [LM.RIGHT_KNEE]: { x: 0.06, y: 0.22 },
      [LM.LEFT_ANKLE]: { x: -0.04, y: 0.45 },
      [LM.RIGHT_ANKLE]: { x: 0.06, y: 0.45 },
    },
  },
  {
    id: "back-glute",
    name: "Back Glute",
    ghostAssetPath: "/poses/back-glute.svg",
    requiredLandmarks: allBodyLandmarks,
    weights: { ...defaultWeights, [LM.LEFT_HIP]: 1.4, [LM.RIGHT_HIP]: 1.4, [LM.LEFT_KNEE]: 0.9, [LM.RIGHT_KNEE]: 0.9 },
    templateNormalized: {
      [LM.NOSE]: { x: 0, y: -0.47 },
      [LM.LEFT_SHOULDER]: { x: -0.13, y: -0.33 },
      [LM.RIGHT_SHOULDER]: { x: 0.13, y: -0.33 },
      [LM.LEFT_ELBOW]: { x: -0.18, y: -0.18 },
      [LM.RIGHT_ELBOW]: { x: 0.18, y: -0.18 },
      [LM.LEFT_WRIST]: { x: -0.10, y: -0.05 },
      [LM.RIGHT_WRIST]: { x: 0.10, y: -0.05 },
      [LM.LEFT_HIP]: { x: -0.09, y: 0.0 },
      [LM.RIGHT_HIP]: { x: 0.09, y: 0.0 },
      [LM.LEFT_KNEE]: { x: -0.10, y: 0.22 },
      [LM.RIGHT_KNEE]: { x: 0.10, y: 0.22 },
      [LM.LEFT_ANKLE]: { x: -0.12, y: 0.45 },
      [LM.RIGHT_ANKLE]: { x: 0.08, y: 0.45 },
    },
  },
];

export function getTemplate(id: string): PoseTemplate | undefined {
  return POSE_TEMPLATES.find((t) => t.id === id);
}
