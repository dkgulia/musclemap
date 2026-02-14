"use client";

import { useState, useCallback } from "react";
import type {
  ClassificationResult,
  Measurements,
  SymmetryData,
  ScanCategory,
} from "../models/types";

interface Props {
  classification: ClassificationResult;
  measurements: Measurements | null;
  symmetryData: SymmetryData | null;
  canvas: HTMLCanvasElement;
  avgBrightness: number;
  /** Whether a coach report is being generated */
  coachLoading?: boolean;
  coachReport?: string | null;
  onRequestCoach?: () => void;
  onSave: (savePhoto: boolean) => void;
  onRetake: () => void;
  saved?: boolean;
  savedCategory?: ScanCategory | null;
}

function categoryBadge(cat: ScanCategory): { label: string; color: string; bg: string } {
  switch (cat) {
    case "CHECKIN_FULL":
      return { label: "Full Check-in", color: "text-emerald-400", bg: "bg-emerald-500/10" };
    case "CHECKIN_SELFIE":
      return { label: "Selfie Check-in", color: "text-blue-400", bg: "bg-blue-500/10" };
    case "GALLERY":
      return { label: "Gallery", color: "text-text2", bg: "bg-text/[0.05]" };
  }
}

function ScoreBar({ label, value, max = 100 }: { label: string; value: number; max?: number }) {
  const pct = Math.min(100, (value / max) * 100);
  const color = value >= 70 ? "bg-emerald-500" : value >= 40 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-muted w-16 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-text2 w-8 text-right">{Math.round(value)}</span>
    </div>
  );
}

export default function PhotoResultSheet({
  classification,
  measurements,
  symmetryData,
  canvas,
  coachLoading,
  coachReport,
  onRequestCoach,
  onSave,
  onRetake,
  saved,
  savedCategory,
}: Props) {
  const [savePhoto, setSavePhoto] = useState(classification.category !== "CHECKIN_FULL");
  const badge = categoryBadge(classification.category);

  const renderCanvas = useCallback(
    (el: HTMLCanvasElement | null) => {
      if (el && canvas) {
        el.width = canvas.width;
        el.height = canvas.height;
        const ctx = el.getContext("2d");
        if (ctx) ctx.drawImage(canvas, 0, 0);
      }
    },
    [canvas]
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Photo with category badge */}
      <div className="mx-5">
        <div className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden border border-border bg-black">
          <canvas ref={renderCanvas} className="w-full h-full object-cover" />

          {/* Category badge */}
          <div className={`absolute top-3 left-3 ${badge.bg} backdrop-blur-sm rounded-lg px-2.5 py-1.5`}>
            <span className={`text-[11px] font-medium ${badge.color}`}>{badge.label}</span>
          </div>

          {/* Quality score */}
          <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm rounded-lg px-2.5 py-1.5">
            <span className={`text-[11px] font-medium ${
              classification.scores.quality >= 70 ? "text-emerald-400" :
              classification.scores.quality >= 40 ? "text-amber-400" : "text-red-400"
            }`}>
              Quality {Math.round(classification.scores.quality)}
            </span>
          </div>
        </div>
      </div>

      {/* Tracked regions */}
      {classification.trackedRegions.length > 0 && (
        <div className="mx-5">
          <div className="flex flex-wrap gap-1.5">
            {classification.trackedRegions.map((region) => (
              <span
                key={region}
                className="text-[10px] px-2 py-1 rounded-full bg-accent/10 text-accent"
              >
                {region}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tips */}
      {classification.tips.length > 0 && (
        <div className="mx-5 px-4 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
          {classification.tips.map((tip, i) => (
            <p key={i} className="text-[11px] text-amber-400">
              {tip}
            </p>
          ))}
        </div>
      )}

      {/* Score breakdown */}
      <div className="mx-5 bg-surface border border-border rounded-2xl p-4">
        <h3 className="text-xs font-medium text-text mb-3">Scores</h3>
        <div className="space-y-2">
          <ScoreBar label="Quality" value={classification.scores.quality} />
          <ScoreBar label="Lighting" value={classification.scores.lighting} />
          <ScoreBar label="Framing" value={classification.scores.framing} />
          <ScoreBar label="Pose" value={classification.scores.poseMatch} />
        </div>
      </div>

      {/* Measurements */}
      {measurements && (
        <div className="mx-5 bg-surface border border-border rounded-2xl p-4">
          <h3 className="text-xs font-medium text-text mb-3">Measurements</h3>
          <div className="space-y-1.5">
            {measurements.shoulderWidthCm > 0 && (
              <div className="flex justify-between">
                <span className="text-[11px] text-muted">Shoulders</span>
                <span className="text-xs text-text">{measurements.shoulderWidthCm.toFixed(1)} cm</span>
              </div>
            )}
            {measurements.hipWidthCm > 0 && (
              <div className="flex justify-between">
                <span className="text-[11px] text-muted">Hips</span>
                <span className="text-xs text-text">{measurements.hipWidthCm.toFixed(1)} cm</span>
              </div>
            )}
            {measurements.vTaperIndex > 0 && (
              <div className="flex justify-between">
                <span className="text-[11px] text-muted">V-Taper</span>
                <span className="text-xs text-text">{measurements.vTaperIndex.toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Symmetry */}
      {symmetryData && symmetryData.overallScore < 85 && (
        <div className="mx-5 bg-surface border border-border rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-medium text-text">Symmetry</h3>
            <span className={`text-[11px] font-medium ${
              symmetryData.overallScore >= 85 ? "text-emerald-400" :
              symmetryData.overallScore >= 70 ? "text-amber-400" : "text-red-400"
            }`}>
              {Math.round(symmetryData.overallScore)}%
            </span>
          </div>
          <div className="space-y-1">
            {symmetryData.pairs.filter(p => p.status !== "balanced").map((pair) => (
              <div key={pair.label} className="flex justify-between">
                <span className="text-[11px] text-muted capitalize">{pair.label}</span>
                <span className={`text-[10px] ${pair.status === "moderate" ? "text-amber-400" : "text-red-400"}`}>
                  {pair.overallDiffPct.toFixed(1)}% diff
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Coach report */}
      {coachReport && (
        <div className="mx-5 bg-surface border border-accent/20 rounded-2xl p-4">
          <h3 className="text-xs font-medium text-accent mb-2">Coach Report</h3>
          <p className="text-[11px] text-text2 leading-relaxed whitespace-pre-line">{coachReport}</p>
        </div>
      )}

      {/* Actions */}
      {!saved ? (
        <div className="mx-5 flex flex-col gap-2">
          {/* Save photo toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={savePhoto}
              onChange={(e) => setSavePhoto(e.target.checked)}
              className="w-4 h-4 rounded border-border accent-accent"
            />
            <span className="text-xs text-text2">Save photo locally</span>
          </label>

          {/* Save button */}
          <button
            onClick={() => onSave(savePhoto)}
            className={`w-full py-3 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
              classification.category === "CHECKIN_FULL"
                ? "bg-emerald-600 text-white"
                : classification.category === "CHECKIN_SELFIE"
                ? "bg-blue-600 text-white"
                : "bg-accent text-accent-fg"
            }`}
          >
            Save as {badge.label}
          </button>

          {/* Coach button */}
          {onRequestCoach && !coachReport && (
            <button
              onClick={onRequestCoach}
              disabled={coachLoading}
              className="w-full py-2.5 rounded-xl bg-surface border border-accent/30 text-xs text-accent font-medium cursor-pointer disabled:opacity-50"
            >
              {coachLoading ? "Generating coach report..." : "Get AI Coach Report"}
            </button>
          )}

          {/* Retake */}
          <button
            onClick={onRetake}
            className="w-full py-2.5 rounded-xl bg-surface border border-border text-xs text-text2 cursor-pointer"
          >
            Retake
          </button>
        </div>
      ) : (
        <div className="mx-5 bg-surface border border-accent/20 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            <span className="text-sm font-medium text-text">
              Saved as {savedCategory ? categoryBadge(savedCategory).label : badge.label}
            </span>
          </div>
          <button
            onClick={onRetake}
            className="mt-2 w-full py-2.5 rounded-xl bg-accent text-accent-fg text-xs font-medium cursor-pointer"
          >
            Analyze Another Photo
          </button>
        </div>
      )}
    </div>
  );
}
