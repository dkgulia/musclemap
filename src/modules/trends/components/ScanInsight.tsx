"use client";

import type { ScanRecord } from "@/modules/scan/models/types";
import {
  getGrade,
  V_TAPER_GRADES,
  SHOULDER_RATIO_GRADES,
  SYMMETRY_GRADES,
  getPoseInsight,
} from "@/modules/scan/models/physiqueBenchmarks";

const POSE_NAMES: Record<string, string> = {
  "front-biceps": "Front Biceps",
  "back-lats": "Back Lats",
  "side-glute": "Side Glute",
  "back-glute": "Back Glute",
};

interface Props {
  poseId: string;
  vTaper: number;
  shoulderIdx: number;
  symmetryScore: number | null;
  shoulderCm: number;
  previousScan: ScanRecord | null;
}

function formatDelta(current: number, previous: number, suffix = ""): string | null {
  if (previous === 0) return null;
  const diff = current - previous;
  const pct = ((diff / previous) * 100).toFixed(1);
  if (Math.abs(diff) < 0.001) return null;
  const sign = diff > 0 ? "+" : "";
  return suffix
    ? `${sign}${diff.toFixed(1)}${suffix}`
    : `${sign}${pct}%`;
}

export default function ScanInsight({
  poseId,
  vTaper,
  shoulderIdx,
  symmetryScore,
  shoulderCm,
  previousScan,
}: Props) {
  const vtGrade = getGrade(vTaper, V_TAPER_GRADES);
  const shGrade = getGrade(shoulderIdx, SHOULDER_RATIO_GRADES);
  const symGrade = symmetryScore != null ? getGrade(symmetryScore, SYMMETRY_GRADES) : null;
  const insight = getPoseInsight(poseId, vTaper, symmetryScore);

  const vtDelta = previousScan ? formatDelta(vTaper, previousScan.vTaperIndex) : null;
  const shDelta = previousScan && shoulderCm > 0 && previousScan.shoulderWidthCm > 0
    ? formatDelta(shoulderCm, previousScan.shoulderWidthCm, "cm")
    : null;

  return (
    <div className="mx-5 bg-surface border border-accent/20 rounded-2xl p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <path d="M20 6L9 17l-5-5" />
        </svg>
        <span className="text-sm font-medium text-text">
          {POSE_NAMES[poseId] || poseId} captured
        </span>
      </div>

      {/* Metrics */}
      <div className="space-y-2 mb-3">
        {/* V-Taper */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">V-Taper</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono text-text">{vTaper.toFixed(2)}</span>
            <span className={`text-xs font-medium ${vtGrade.color}`}>{vtGrade.label}</span>
            {vtDelta && (
              <span className={`text-[11px] ${parseFloat(vtDelta) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {vtDelta}
              </span>
            )}
          </div>
        </div>

        {/* Shoulders */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">Shoulders</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono text-text">
              {shoulderCm > 0 ? `${shoulderCm.toFixed(1)}cm` : shoulderIdx.toFixed(3)}
            </span>
            <span className={`text-xs font-medium ${shGrade.color}`}>{shGrade.label}</span>
            {shDelta && (
              <span className={`text-[11px] ${parseFloat(shDelta) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {shDelta}
              </span>
            )}
          </div>
        </div>

        {/* Symmetry */}
        {symGrade && symmetryScore != null && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">Symmetry</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono text-text">{Math.round(symmetryScore)}%</span>
              <span className={`text-xs font-medium ${symGrade.color}`}>{symGrade.label}</span>
            </div>
          </div>
        )}
      </div>

      {/* Insight */}
      <p className="text-[11px] text-text2 leading-relaxed">{insight}</p>
    </div>
  );
}
