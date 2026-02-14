"use client";

import { useState } from "react";
import type { ScanRecord } from "@/modules/scan/models/types";
import { POSE_NAMES } from "@/modules/scan/models/poseNames";

interface Props {
  scans: ScanRecord[];
  poseId: string;
}

export default function GrowthInsights({ scans, poseId }: Props) {
  const poseName = POSE_NAMES[poseId] || poseId;
  const photosWithImage = scans.filter((s) => s.photoDataUrl);
  // Capture "now" once on mount so Date.now() isn't called during re-renders
  const [now] = useState(() => Date.now());

  if (scans.length === 0) {
    return (
      <div className="bg-surface rounded-2xl border border-border p-4 text-center">
        <p className="text-sm text-text2 mb-1">No photos yet</p>
        <p className="text-xs text-muted">
          Hit your first {poseName} pose to start tracking
        </p>
      </div>
    );
  }

  const oldest = scans[scans.length - 1];
  const daysBetween = Math.round((now - oldest.timestamp) / 86400000);
  const weeks = Math.max(1, Math.round(daysBetween / 7));

  return (
    <div className="bg-surface rounded-2xl border border-border p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] text-muted uppercase tracking-wider">
          {poseName}
        </p>
        <p className="text-[10px] text-muted">
          {photosWithImage.length} photo{photosWithImage.length !== 1 ? "s" : ""} · {weeks}w
        </p>
      </div>

      <p className="text-sm text-text2 leading-relaxed">
        {scans.length === 1
          ? "First photo logged. Come back next week for a comparison!"
          : scans.length < 4
          ? `${scans.length} photos over ${weeks}w. Keep going — consistency is everything.`
          : `${scans.length} photos over ${weeks}w. Scroll down to see your transformation.`}
      </p>

      <p className="text-[11px] text-muted mt-2">
        Log tape measurements in Profile for the full picture.
      </p>
    </div>
  );
}
