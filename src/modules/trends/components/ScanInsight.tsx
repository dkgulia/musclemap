"use client";

import type { ScanRecord } from "@/modules/scan/models/types";
import { POSE_NAMES } from "@/modules/scan/models/poseNames";

interface Props {
  poseId: string;
  photoDataUrl: string;
  symmetryScore: number | null;
  alignmentScore: number;
  previousScan: ScanRecord | null;
}

function getSymmetryLabel(score: number): { label: string; color: string } {
  if (score >= 90) return { label: "Balanced", color: "text-emerald-400" };
  if (score >= 75) return { label: "Moderate", color: "text-amber-400" };
  return { label: "Imbalanced", color: "text-red-400" };
}

function getPoseQuality(alignment: number): { label: string; color: string } {
  if (alignment >= 75) return { label: "Great", color: "text-emerald-400" };
  if (alignment >= 55) return { label: "Good", color: "text-text2" };
  return { label: "Okay", color: "text-muted" };
}

function timeSince(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

export default function ScanInsight({
  poseId,
  photoDataUrl,
  symmetryScore,
  alignmentScore,
  previousScan,
}: Props) {
  const poseName = POSE_NAMES[poseId] || poseId;
  const sym = symmetryScore != null ? getSymmetryLabel(symmetryScore) : null;
  const quality = getPoseQuality(alignmentScore);

  return (
    <div className="mx-5 bg-surface border border-accent/20 rounded-2xl overflow-hidden">
      {/* Photo thumbnail */}
      {photoDataUrl && (
        <div className="w-full aspect-[3/4] max-h-48 overflow-hidden">
          <img
            src={photoDataUrl}
            alt={`${poseName} progress photo`}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="p-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          <span className="text-sm font-medium text-text">
            {poseName} captured
          </span>
        </div>

        {/* Simple labels */}
        <div className="space-y-1.5 mb-3">
          {sym && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">Symmetry</span>
              <span className={`text-xs font-medium ${sym.color}`}>{sym.label}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">Pose quality</span>
            <span className={`text-xs font-medium ${quality.color}`}>{quality.label}</span>
          </div>
        </div>

        {/* Previous scan reference */}
        {previousScan ? (
          <p className="text-[11px] text-muted">
            vs last photo: {timeSince(previousScan.timestamp)}
          </p>
        ) : (
          <p className="text-[11px] text-muted">
            First {poseName} photo — keep it up!
          </p>
        )}
      </div>
    </div>
  );
}
