/**
 * Check-in validation gates — pure functions, no IndexedDB access.
 * Previous scan passed in as argument by the caller.
 */

import type {
  Landmark,
  CheckinGateResult,
  ConsistencyDetails,
  ScanRecord,
} from "../models/types";
import { LM } from "../models/types";

// ─── Gate A: Required joints visible ──────────────────────────

const FRONT_REQUIRED = [
  LM.NOSE,
  LM.LEFT_SHOULDER,
  LM.RIGHT_SHOULDER,
  LM.LEFT_HIP,
  LM.RIGHT_HIP,
  LM.LEFT_KNEE,
  LM.RIGHT_KNEE,
  LM.LEFT_ANKLE,
  LM.RIGHT_ANKLE,
];

const BACK_REQUIRED = [...FRONT_REQUIRED];

const VIS_THRESHOLD = 0.5;

const JOINT_NAMES: Record<number, string> = {
  [LM.NOSE]: "Head",
  [LM.LEFT_SHOULDER]: "Left Shoulder",
  [LM.RIGHT_SHOULDER]: "Right Shoulder",
  [LM.LEFT_HIP]: "Left Hip",
  [LM.RIGHT_HIP]: "Right Hip",
  [LM.LEFT_KNEE]: "Left Knee",
  [LM.RIGHT_KNEE]: "Right Knee",
  [LM.LEFT_ANKLE]: "Left Ankle",
  [LM.RIGHT_ANKLE]: "Right Ankle",
};

export function getRequiredJoints(poseType: string): number[] {
  if (poseType === "back-checkin") return BACK_REQUIRED;
  return FRONT_REQUIRED;
}

function checkGateA(
  landmarks: Landmark[],
  poseType: string
): { passed: boolean; missingJoints: string[] } {
  const required = getRequiredJoints(poseType);
  const missing: string[] = [];
  for (const idx of required) {
    const lm = landmarks[idx];
    if (!lm || lm.visibility < VIS_THRESHOLD) {
      missing.push(JOINT_NAMES[idx] ?? `Joint ${idx}`);
    }
  }
  return { passed: missing.length === 0, missingJoints: missing };
}

// ─── Gate B: Standing detector ────────────────────────────────

function checkGateB(
  landmarks: Landmark[],
  imageWidth: number,
  imageHeight: number
): { passed: boolean; reason: string } {
  const lAnkle = landmarks[LM.LEFT_ANKLE];
  const rAnkle = landmarks[LM.RIGHT_ANKLE];
  const lKnee = landmarks[LM.LEFT_KNEE];
  const rKnee = landmarks[LM.RIGHT_KNEE];
  const lHip = landmarks[LM.LEFT_HIP];
  const rHip = landmarks[LM.RIGHT_HIP];

  if (!lAnkle || !rAnkle || !lKnee || !rKnee || !lHip || !rHip) {
    return { passed: false, reason: "Missing lower-body joints" };
  }

  // ankleY > kneeY > hipY (image coords, Y increases downward)
  const ankleY = ((lAnkle.y + rAnkle.y) / 2) * imageHeight;
  const kneeY = ((lKnee.y + rKnee.y) / 2) * imageHeight;
  const hipY = ((lHip.y + rHip.y) / 2) * imageHeight;

  if (!(ankleY > kneeY && kneeY > hipY)) {
    return {
      passed: false,
      reason: "Not standing upright — ankles should be below knees and hips",
    };
  }

  // Hip-knee-ankle angle should be near 180° (straight legs)
  const leftAngle = legAngle(lHip, lKnee, lAnkle, imageWidth, imageHeight);
  const rightAngle = legAngle(rHip, rKnee, rAnkle, imageWidth, imageHeight);
  const avgAngle = (leftAngle + rightAngle) / 2;
  if (avgAngle < 155) {
    return {
      passed: false,
      reason: "Legs not straight — stand upright with straight legs",
    };
  }

  // Torso lean check: shoulder midpoint above hip midpoint
  const lShoulder = landmarks[LM.LEFT_SHOULDER];
  const rShoulder = landmarks[LM.RIGHT_SHOULDER];
  if (lShoulder && rShoulder) {
    const shoulderMidX =
      ((lShoulder.x + rShoulder.x) / 2) * imageWidth;
    const hipMidX = ((lHip.x + rHip.x) / 2) * imageWidth;
    const torsoHeight =
      hipY - ((lShoulder.y + rShoulder.y) / 2) * imageHeight;
    if (torsoHeight > 0) {
      const leanDeg =
        Math.abs(Math.atan2(shoulderMidX - hipMidX, torsoHeight)) *
        (180 / Math.PI);
      if (leanDeg > 12) {
        return {
          passed: false,
          reason: "Leaning too much — stand straight",
        };
      }
    }
  }

  return { passed: true, reason: "" };
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

// ─── Gate C: Consistency vs last CHECKIN ──────────────────────

function checkGateC(
  bodyHeightPx: number,
  stanceWidthPx: number,
  hipTiltDeg: number,
  prevCheckin: ScanRecord | null
): { passed: boolean; details: ConsistencyDetails; score: number } {
  const defaults: ConsistencyDetails = {
    scaleMatch: true,
    stanceMatch: true,
    hipTiltMatch: true,
    brightnessMatch: true,
  };

  if (!prevCheckin) {
    return { passed: true, details: defaults, score: 100 };
  }

  let passes = 0;
  const details = { ...defaults };

  // Scale: bodyHeightPx within ±7%
  if (prevCheckin.bodyHeightPx > 0 && bodyHeightPx > 0) {
    const diff =
      Math.abs(bodyHeightPx - prevCheckin.bodyHeightPx) /
      prevCheckin.bodyHeightPx;
    details.scaleMatch = diff <= 0.07;
  }
  if (details.scaleMatch) passes++;

  // Stance within ±8%
  const prevStancePx = prevCheckin.stanceWidthPx ?? 0;
  if (prevStancePx > 0 && stanceWidthPx > 0) {
    const diff =
      Math.abs(stanceWidthPx - prevStancePx) / prevStancePx;
    details.stanceMatch = diff <= 0.08;
  }
  if (details.stanceMatch) passes++;

  // Hip tilt within ±6°
  const prevTilt = prevCheckin.hipTiltDeg ?? 0;
  details.hipTiltMatch = Math.abs(hipTiltDeg - prevTilt) <= 6;
  if (details.hipTiltMatch) passes++;

  // Brightness within ±25 luma
  const prevBright = prevCheckin.avgBrightness ?? 0;
  details.brightnessMatch =
    prevBright === 0 ? true : true; // Auto-pass until luma is stored
  if (details.brightnessMatch) passes++;

  const score = (passes / 4) * 100;
  return { passed: score >= 65, details, score };
}

// ─── Gate D: Time gate ────────────────────────────────────────

function checkGateD(prevCheckin: ScanRecord | null): {
  warning: boolean;
  sameDayBlock: boolean;
  daysSinceLastCheckin: number | null;
} {
  if (!prevCheckin) {
    return { warning: false, sameDayBlock: false, daysSinceLastCheckin: null };
  }

  const msSince = Date.now() - prevCheckin.timestamp;
  const daysSince = msSince / 86400000;

  return {
    warning: daysSince < 7 && daysSince >= 1,
    sameDayBlock: daysSince < 1,
    daysSinceLastCheckin: Math.floor(daysSince),
  };
}

// ─── Main entry point ─────────────────────────────────────────

export function runCheckinGates(
  landmarks: Landmark[],
  imageWidth: number,
  imageHeight: number,
  poseType: string,
  bodyHeightPx: number,
  stanceWidthPx: number,
  hipTiltDeg: number,
  prevCheckin: ScanRecord | null
): CheckinGateResult {
  const gateA = checkGateA(landmarks, poseType);
  const gateB = checkGateB(landmarks, imageWidth, imageHeight);
  const gateC = checkGateC(bodyHeightPx, stanceWidthPx, hipTiltDeg, prevCheckin);
  const gateD = checkGateD(prevCheckin);

  const allPassed =
    gateA.passed && gateB.passed && gateC.passed && !gateD.sameDayBlock;

  return { gateA, gateB, gateC, gateD, allPassed };
}
