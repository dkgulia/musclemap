"use client";

import type { ScanRecord } from "@/modules/scan/models/types";
import {
  getGrade,
  V_TAPER_GRADES,
  SYMMETRY_GRADES,
} from "@/modules/scan/models/physiqueBenchmarks";

const POSE_NAMES: Record<string, string> = {
  "front-biceps": "Front Biceps",
  "back-lats": "Back Lats",
  "side-glute": "Side Glute",
  "back-glute": "Back Glute",
};

interface Props {
  scans: ScanRecord[];
  poseId: string;
}

export default function GrowthInsights({ scans, poseId }: Props) {
  const poseName = POSE_NAMES[poseId] || poseId;

  if (scans.length === 0) {
    return (
      <div className="bg-surface rounded-2xl border border-border p-4 text-center">
        <p className="text-sm text-text2 mb-1">No scans yet</p>
        <p className="text-xs text-muted">
          Hit your first {poseName} pose to start tracking
        </p>
      </div>
    );
  }

  if (scans.length < 2) {
    return (
      <div className="bg-surface rounded-2xl border border-border p-4 text-center">
        <p className="text-sm text-text2 mb-1">1 scan logged</p>
        <p className="text-xs text-muted">
          Do another {poseName} to see your progress
        </p>
      </div>
    );
  }

  // scans are newest-first
  const latest = scans[0];
  const earliest = scans[scans.length - 1];
  const daysBetween = Math.round(
    (latest.timestamp - earliest.timestamp) / 86400000
  );
  const weeks = Math.max(1, Math.round(daysBetween / 7));

  const latestVtGrade = getGrade(latest.vTaperIndex, V_TAPER_GRADES);
  const earliestVtGrade = getGrade(earliest.vTaperIndex, V_TAPER_GRADES);
  const vtChanged = latestVtGrade.label !== earliestVtGrade.label;
  const vtPctChange =
    earliest.vTaperIndex > 0
      ? (((latest.vTaperIndex - earliest.vTaperIndex) / earliest.vTaperIndex) * 100)
      : 0;

  const latestSymGrade = latest.symmetryScore > 0 ? getGrade(latest.symmetryScore, SYMMETRY_GRADES) : null;
  const symDelta = latest.symmetryScore > 0 && earliest.symmetryScore > 0
    ? latest.symmetryScore - earliest.symmetryScore
    : null;

  const shCmDelta = latest.shoulderWidthCm > 0 && earliest.shoulderWidthCm > 0
    ? latest.shoulderWidthCm - earliest.shoulderWidthCm
    : null;

  // Generate narrative
  let narrative = "";
  if (vtChanged) {
    narrative = `V-Taper went from ${earliestVtGrade.label} to ${latestVtGrade.label} in ${weeks}w.`;
  } else if (Math.abs(vtPctChange) > 1) {
    narrative = `V-Taper ${vtPctChange > 0 ? "up" : "down"} ${Math.abs(vtPctChange).toFixed(1)}% over ${weeks}w.`;
  } else {
    narrative = `Holding steady over ${weeks}w — consistency is key.`;
  }
  if (shCmDelta && Math.abs(shCmDelta) >= 0.3) {
    narrative += ` Shoulders ${shCmDelta > 0 ? "+" : ""}${shCmDelta.toFixed(1)}cm.`;
  }

  return (
    <div className="bg-surface rounded-2xl border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] text-muted uppercase tracking-wider">
          Your Progress
        </p>
        <p className="text-[10px] text-muted">{scans.length} scans</p>
      </div>

      <div className="space-y-2 mb-3">
        {/* V-Taper */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">V-Taper</span>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium ${latestVtGrade.color}`}>
              {latestVtGrade.label}
            </span>
            <span className="text-sm font-mono text-text">
              {latest.vTaperIndex.toFixed(2)}
            </span>
            {Math.abs(vtPctChange) > 0.5 && (
              <span className={`text-[11px] ${vtPctChange >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {vtPctChange >= 0 ? "+" : ""}{vtPctChange.toFixed(1)}%
              </span>
            )}
          </div>
        </div>

        {/* Shoulder cm */}
        {latest.shoulderWidthCm > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">Shoulders</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono text-text">
                {latest.shoulderWidthCm.toFixed(1)}cm
              </span>
              {shCmDelta && Math.abs(shCmDelta) >= 0.1 && (
                <span className={`text-[11px] ${shCmDelta >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {shCmDelta >= 0 ? "+" : ""}{shCmDelta.toFixed(1)}cm
                </span>
              )}
            </div>
          </div>
        )}

        {/* Symmetry */}
        {latestSymGrade && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">Symmetry</span>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium ${latestSymGrade.color}`}>
                {latestSymGrade.label}
              </span>
              <span className="text-sm font-mono text-text">
                {Math.round(latest.symmetryScore)}%
              </span>
              {symDelta != null && Math.abs(symDelta) >= 1 && (
                <span className={`text-[11px] ${symDelta >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {symDelta >= 0 ? "+" : ""}{Math.round(symDelta)}pts
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <p className="text-[11px] text-text2 leading-relaxed">{narrative}</p>
    </div>
  );
}
