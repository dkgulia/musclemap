/** Landmark indices from MediaPipe Pose (33 landmarks) */
export const LM = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
} as const;

export interface Point2D {
  x: number;
  y: number;
}

export interface Landmark {
  x: number; // 0..1 normalized
  y: number; // 0..1 normalized
  z: number;
  visibility: number; // 0..1
}

/** World landmark — coordinates in meters, hip-centered origin */
export interface WorldLandmark {
  x: number; // meters, left/right of hip center
  y: number; // meters, up/down from hip center
  z: number; // meters, depth
  visibility: number;
}

/** Bundle returned from detectPose() */
export interface PoseDetectionResult {
  landmarks: Landmark[];
  worldLandmarks: WorldLandmark[];
}

export interface PoseTemplate {
  id: string;
  name: string;
  ghostAssetPath: string;
  requiredLandmarks: number[];
  templateNormalized: Record<number, Point2D>;
  weights: Record<number, number>;
}

export interface ScanRecord {
  id?: number; // auto-incremented by IndexedDB
  timestamp: number;
  poseId: string;
  alignmentScore: number;
  confidenceScore: number;
  shoulderIndex: number;
  hipIndex: number;
  vTaperIndex: number;
  shoulderWidthPx: number;
  hipWidthPx: number;
  bodyHeightPx: number;
  // Calibrated real-world measurements (0 if uncalibrated)
  shoulderWidthCm: number;
  hipWidthCm: number;
  bodyHeightCm: number;
}

export interface Measurements {
  shoulderWidthPx: number;
  hipWidthPx: number;
  bodyHeightPx: number;
  shoulderIndex: number;
  hipIndex: number;
  vTaperIndex: number;
  // World-coordinate measurements (meters)
  shoulderWidthM: number;
  hipWidthM: number;
  bodyHeightM: number;
  // Calibrated measurements (cm, 0 if uncalibrated)
  shoulderWidthCm: number;
  hipWidthCm: number;
  bodyHeightCm: number;
}

/** Symmetry comparison for a left/right landmark pair */
export interface SymmetryPair {
  leftIndex: number;
  rightIndex: number;
  label: string;
  heightDiffPct: number;
  distanceDiffPct: number;
  overallDiffPct: number;
  status: "balanced" | "moderate" | "imbalanced";
}

export interface SymmetryData {
  pairs: SymmetryPair[];
  overallScore: number; // 0-100
}

/** Left/right landmark pairs for symmetry analysis */
export const SYMMETRY_PAIRS: { left: number; right: number; label: string }[] = [
  { left: LM.LEFT_SHOULDER, right: LM.RIGHT_SHOULDER, label: "shoulder" },
  { left: LM.LEFT_ELBOW, right: LM.RIGHT_ELBOW, label: "elbow" },
  { left: LM.LEFT_HIP, right: LM.RIGHT_HIP, label: "hip" },
  { left: LM.LEFT_KNEE, right: LM.RIGHT_KNEE, label: "knee" },
];

export interface ScoreBreakdown {
  landmarksVisible: number; // 0..30
  brightness: number; // 0..20
  distance: number; // 0..20
  poseMatch: number; // 0..30
}

export interface ScanState {
  landmarks: Landmark[] | null;
  alignmentScore: number;
  confidenceScore: number;
  measurements: Measurements | null;
  breakdown: ScoreBreakdown;
  isReady: boolean;
  readySince: number | null; // timestamp when ready started
  tip: string;
}

/** Skeleton connections for drawing */
export const SKELETON_CONNECTIONS: [number, number][] = [
  [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER],
  [LM.LEFT_SHOULDER, LM.LEFT_ELBOW],
  [LM.LEFT_ELBOW, LM.LEFT_WRIST],
  [LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW],
  [LM.RIGHT_ELBOW, LM.RIGHT_WRIST],
  [LM.LEFT_SHOULDER, LM.LEFT_HIP],
  [LM.RIGHT_SHOULDER, LM.RIGHT_HIP],
  [LM.LEFT_HIP, LM.RIGHT_HIP],
  [LM.LEFT_HIP, LM.LEFT_KNEE],
  [LM.LEFT_KNEE, LM.LEFT_ANKLE],
  [LM.RIGHT_HIP, LM.RIGHT_KNEE],
  [LM.RIGHT_KNEE, LM.RIGHT_ANKLE],
  [LM.NOSE, LM.LEFT_SHOULDER],
  [LM.NOSE, LM.RIGHT_SHOULDER],
];
